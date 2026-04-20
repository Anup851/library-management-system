create extension if not exists "pgcrypto";

-- =========================================================
-- CLEAN START FOR POLICIES/TRIGGERS/FUNCTIONS
-- Keep only schema-level helpers that are compatible with the
-- Node/Express app. Reservation/transaction automation is handled
-- by the application server, so DB-side business triggers are
-- intentionally omitted to avoid duplicate writes.
-- =========================================================

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists update_books_timestamp on public.books;
drop trigger if exists reservation_trigger on public.reservations;
drop trigger if exists transaction_before_trigger on public.transactions;
drop trigger if exists transaction_after_trigger on public.transactions;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.update_updated_at() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_staff() cascade;
drop function if exists public.is_owner(uuid) cascade;
drop function if exists public.calculate_fine(int) cascade;
drop function if exists public.handle_reservation() cascade;
drop function if exists public.handle_transaction_before() cascade;
drop function if exists public.handle_transaction_after() cascade;
drop function if exists public.process_overdue() cascade;

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists public.settings (
  key text primary key,
  value numeric not null
);

insert into public.settings (key, value)
values ('daily_fine', 5)
on conflict (key) do update set value = excluded.value;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text not null default 'student' check (role in ('admin','librarian','student')),
  branch_id uuid references public.branches(id),
  phone text,
  avatar_url text,
  registration_number text unique,
  created_at timestamptz not null default now()
);

-- Backfill compatibility for existing databases created before
-- `registration_number` was introduced on `public.profiles`.
alter table public.profiles
add column if not exists registration_number text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_registration_number_key'
  ) then
    alter table public.profiles
    add constraint profiles_registration_number_key unique (registration_number);
  end if;
end $$;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  category text not null,
  isbn text not null unique,
  barcode text not null unique,
  description text default '',
  cover_image text,
  ebook_url text,
  published_year int,
  language text default 'English',
  format text not null check (format in ('physical','digital','hybrid')),
  total_copies int not null default 1 check (total_copies >= 0),
  available_copies int not null default 1 check (available_copies >= 0 and available_copies <= total_copies),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_branches (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  unique (book_id, branch_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id),
  user_id uuid not null references public.profiles(id),
  branch_id uuid references public.branches(id),
  issued_by uuid references public.profiles(id),
  returned_to uuid references public.profiles(id),
  issued_at timestamptz not null default now(),
  due_date timestamptz not null,
  returned_at timestamptz,
  fine_amount numeric(10,2) not null default 0,
  status text not null default 'ISSUED' check (status in ('ISSUED','RETURNED','OVERDUE'))
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id),
  user_id uuid not null references public.profiles(id),
  status text not null default 'WAITING' check (status in ('WAITING','READY','FULFILLED','CANCELLED')),
  position int not null default 1,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (book_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  channel text not null default 'in_app' check (channel in ('email','sms','in_app')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_books_category on public.books(category);
create index if not exists idx_books_title on public.books(title);
create index if not exists idx_tx_user on public.transactions(user_id);
create index if not exists idx_tx_book on public.transactions(book_id);
create index if not exists idx_tx_status on public.transactions(status);
create index if not exists idx_res_book on public.reservations(book_id);
create index if not exists idx_res_user on public.reservations(user_id);
create index if not exists idx_notif_user on public.notifications(user_id);
create index if not exists idx_reviews_user on public.reviews(user_id);
create index if not exists idx_reviews_book on public.reviews(book_id);
create index if not exists idx_audit_actor on public.audit_logs(actor_id);

-- =========================================================
-- HELPER FUNCTIONS
-- =========================================================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin','librarian'), false)
$$;

create or replace function public.calculate_fine(days_late int)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  fine numeric;
begin
  select value into fine
  from public.settings
  where key = 'daily_fine';

  return greatest(days_late, 0) * coalesce(fine, 0);
end;
$$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- AUTH PROFILE CREATION
-- admin123@gmail.com      -> admin
-- librarian123@gmail.com  -> librarian
-- everyone else           -> student
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case
      when new.email = 'admin123@gmail.com' then 'admin'
      when new.email = 'librarian123@gmail.com' then 'librarian'
      else 'student'
    end
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, role)
select id, email, 'admin'
from auth.users
where email = 'admin123@gmail.com'
on conflict (id) do update set role = 'admin', email = excluded.email;

insert into public.profiles (id, email, role)
select id, email, 'librarian'
from auth.users
where email = 'librarian123@gmail.com'
on conflict (id) do update set role = 'librarian', email = excluded.email;

insert into public.profiles (id, full_name, email, role)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', ''),
  email,
  case
    when email = 'admin123@gmail.com' then 'admin'
    when email = 'librarian123@gmail.com' then 'librarian'
    else 'student'
  end
from auth.users
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
  role = excluded.role;

create trigger update_books_timestamp
before update on public.books
for each row execute procedure public.update_updated_at();

create or replace function public.process_overdue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id, due_date
    from public.transactions
    where status = 'ISSUED' and due_date < now()
  loop
    update public.transactions
    set status = 'OVERDUE',
        fine_amount = public.calculate_fine(
          ceil(extract(epoch from (now() - r.due_date)) / 86400.0)
        )
    where id = r.id;
  end loop;
end;
$$;

-- =========================================================
-- ROW LEVEL SECURITY
-- App behavior:
--   * Students only read their own active loans.
--   * Students only read their own WAITING reservations.
--   * Accepted/declined/fulfilled reservations are hidden from
--     student lists; users learn via notifications instead.
--   * Reviews are public.
--   * Staff can view/manage everything.
-- =========================================================

alter table public.profiles       enable row level security;
alter table public.books          enable row level security;
alter table public.book_branches  enable row level security;
alter table public.transactions   enable row level security;
alter table public.reservations   enable row level security;
alter table public.notifications  enable row level security;
alter table public.reviews        enable row level security;
alter table public.audit_logs     enable row level security;
alter table public.branches       enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_admin_manage" on public.profiles;
drop policy if exists "branches_read" on public.branches;
drop policy if exists "branches_admin_manage" on public.branches;
drop policy if exists "books_read" on public.books;
drop policy if exists "books_staff_manage" on public.books;
drop policy if exists "book_branches_read" on public.book_branches;
drop policy if exists "book_branches_staff_manage" on public.book_branches;
drop policy if exists "transactions_student_read" on public.transactions;
drop policy if exists "transactions_staff_manage" on public.transactions;
drop policy if exists "reservations_student_insert" on public.reservations;
drop policy if exists "reservations_read" on public.reservations;
drop policy if exists "reservations_update_self" on public.reservations;
drop policy if exists "reservations_staff_manage" on public.reservations;
drop policy if exists "reviews_read" on public.reviews;
drop policy if exists "reviews_student_insert" on public.reviews;
drop policy if exists "reviews_update_self" on public.reviews;
drop policy if exists "reviews_delete_self" on public.reviews;
drop policy if exists "notifications_read" on public.notifications;
drop policy if exists "notifications_update_self" on public.notifications;
drop policy if exists "notifications_staff_insert" on public.notifications;
drop policy if exists "notifications_delete_self" on public.notifications;
drop policy if exists "audit_logs_admin_read" on public.audit_logs;

create policy "profiles_select"
on public.profiles
for select
using (auth.uid() = id or public.is_staff());

create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "profiles_admin_manage"
on public.profiles
for all
using (public.is_admin())
with check (public.is_admin());

create policy "branches_read"
on public.branches
for select
using (true);

create policy "branches_admin_manage"
on public.branches
for all
using (public.is_admin())
with check (public.is_admin());

create policy "books_read"
on public.books
for select
using (true);

create policy "books_staff_manage"
on public.books
for all
using (public.is_staff())
with check (public.is_staff());

create policy "book_branches_read"
on public.book_branches
for select
using (true);

create policy "book_branches_staff_manage"
on public.book_branches
for all
using (public.is_staff())
with check (public.is_staff());

create policy "transactions_student_read"
on public.transactions
for select
using (auth.uid() = user_id and status <> 'RETURNED');

create policy "transactions_staff_manage"
on public.transactions
for all
using (public.is_staff())
with check (public.is_staff());

create policy "reservations_student_insert"
on public.reservations
for insert
with check (auth.uid() = user_id and status = 'WAITING');

create policy "reservations_read"
on public.reservations
for select
using (
  public.is_staff()
  or (auth.uid() = user_id and status = 'WAITING')
);

create policy "reservations_update_self"
on public.reservations
for update
using (auth.uid() = user_id and status = 'WAITING')
with check (auth.uid() = user_id and status in ('WAITING', 'CANCELLED'));

create policy "reservations_staff_manage"
on public.reservations
for all
using (public.is_staff())
with check (public.is_staff());

create policy "reviews_read"
on public.reviews
for select
using (true);

create policy "reviews_student_insert"
on public.reviews
for insert
with check (auth.uid() = user_id);

create policy "reviews_update_self"
on public.reviews
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "reviews_delete_self"
on public.reviews
for delete
using (auth.uid() = user_id);

create policy "notifications_read"
on public.notifications
for select
using (auth.uid() = user_id or public.is_staff());

create policy "notifications_update_self"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notifications_delete_self"
on public.notifications
for delete
using (auth.uid() = user_id or public.is_staff());

create policy "notifications_staff_insert"
on public.notifications
for insert
with check (public.is_staff());

create policy "audit_logs_admin_read"
on public.audit_logs
for select
using (public.is_admin());
