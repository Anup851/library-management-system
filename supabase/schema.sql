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

do $$
declare
  trigger_record record;
begin
  for trigger_record in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and (
        (n.nspname = 'auth' and c.relname = 'users')
        or (n.nspname = 'public' and c.relname in ('books', 'transactions', 'reservations', 'return_requests'))
      )
  loop
    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_record.trigger_name,
      trigger_record.schema_name,
      trigger_record.table_name
    );
  end loop;
end $$;

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

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'branches',
        'books',
        'book_branches',
        'transactions',
        'reservations',
        'return_requests',
        'reviews',
        'notifications',
        'audit_logs'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

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
  branch_id uuid references public.branches(id) on delete set null,
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
  format text not null default 'physical',
  total_copies int not null default 1,
  available_copies int not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
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
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  issued_by uuid references public.profiles(id) on delete set null,
  returned_to uuid references public.profiles(id) on delete set null,
  issued_at timestamptz not null default now(),
  due_date timestamptz not null,
  returned_at timestamptz,
  fine_amount numeric(10,2) not null default 0,
  status text not null default 'ISSUED' check (status in ('ISSUED','RETURNED','OVERDUE'))
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'WAITING' check (status in ('WAITING','READY','FULFILLED','CANCELLED')),
  position int not null default 1,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','DECLINED')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  note text
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
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Repair and normalize `books` constraints for both fresh and existing databases.
-- This runs after `transactions` exists so active-loan reconciliation can succeed.
do $$
begin
  alter table public.books drop constraint if exists book_check;
  alter table public.books drop constraint if exists books_format_check;
  alter table public.books drop constraint if exists books_total_copies_check;
  alter table public.books drop constraint if exists books_available_copies_check;

  update public.books
  set total_copies = greatest(coalesce(total_copies, 0), 0),
      available_copies = least(
        greatest(coalesce(available_copies, 0), 0),
        greatest(coalesce(total_copies, 0), 0)
      );

  update public.books b
  set available_copies = greatest(
        0,
        least(
          b.total_copies,
          b.total_copies - coalesce(active_loans.loan_count, 0)
        )
      )
  from (
    select book_id, count(*)::int as loan_count
    from public.transactions
    where status in ('ISSUED', 'OVERDUE')
    group by book_id
  ) active_loans
  where active_loans.book_id = b.id;

  alter table public.books
    alter column format set default 'physical',
    alter column total_copies set default 1,
    alter column available_copies set default 1;

  alter table public.books
    add constraint books_format_check
    check (format in ('physical','digital','hybrid'));

  alter table public.books
    add constraint books_total_copies_check
    check (total_copies >= 0);

  alter table public.books
    add constraint books_available_copies_check
    check (available_copies >= 0 and available_copies <= total_copies);
exception
  when duplicate_object then null;
end $$;

-- Rewrite existing foreign keys on older databases so deletes cascade
-- instead of failing when child rows still exist.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_branch_id_fkey'
  ) then
    alter table public.profiles drop constraint profiles_branch_id_fkey;
  end if;
  alter table public.profiles
    add constraint profiles_branch_id_fkey
    foreign key (branch_id) references public.branches(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'return_requests_transaction_id_fkey'
  ) then
    alter table public.return_requests drop constraint return_requests_transaction_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'return_requests_book_id_fkey'
  ) then
    alter table public.return_requests drop constraint return_requests_book_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'return_requests_user_id_fkey'
  ) then
    alter table public.return_requests drop constraint return_requests_user_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'return_requests_reviewed_by_fkey'
  ) then
    alter table public.return_requests drop constraint return_requests_reviewed_by_fkey;
  end if;

  alter table public.return_requests
    add constraint return_requests_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade;
  alter table public.return_requests
    add constraint return_requests_book_id_fkey
    foreign key (book_id) references public.books(id) on delete cascade;
  alter table public.return_requests
    add constraint return_requests_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
  alter table public.return_requests
    add constraint return_requests_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'books_created_by_fkey'
  ) then
    alter table public.books drop constraint books_created_by_fkey;
  end if;
  alter table public.books
    add constraint books_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'transactions_book_id_fkey'
  ) then
    alter table public.transactions drop constraint transactions_book_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'transactions_user_id_fkey'
  ) then
    alter table public.transactions drop constraint transactions_user_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'transactions_branch_id_fkey'
  ) then
    alter table public.transactions drop constraint transactions_branch_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'transactions_issued_by_fkey'
  ) then
    alter table public.transactions drop constraint transactions_issued_by_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'transactions_returned_to_fkey'
  ) then
    alter table public.transactions drop constraint transactions_returned_to_fkey;
  end if;

  alter table public.transactions
    add constraint transactions_book_id_fkey
    foreign key (book_id) references public.books(id) on delete cascade;
  alter table public.transactions
    add constraint transactions_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
  alter table public.transactions
    add constraint transactions_branch_id_fkey
    foreign key (branch_id) references public.branches(id) on delete set null;
  alter table public.transactions
    add constraint transactions_issued_by_fkey
    foreign key (issued_by) references public.profiles(id) on delete set null;
  alter table public.transactions
    add constraint transactions_returned_to_fkey
    foreign key (returned_to) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'reservations_book_id_fkey'
  ) then
    alter table public.reservations drop constraint reservations_book_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'reservations_user_id_fkey'
  ) then
    alter table public.reservations drop constraint reservations_user_id_fkey;
  end if;

  alter table public.reservations
    add constraint reservations_book_id_fkey
    foreign key (book_id) references public.books(id) on delete cascade;
  alter table public.reservations
    add constraint reservations_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'reviews_book_id_fkey'
  ) then
    alter table public.reviews drop constraint reviews_book_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'reviews_user_id_fkey'
  ) then
    alter table public.reviews drop constraint reviews_user_id_fkey;
  end if;

  alter table public.reviews
    add constraint reviews_book_id_fkey
    foreign key (book_id) references public.books(id) on delete cascade;
  alter table public.reviews
    add constraint reviews_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_actor_id_fkey'
  ) then
    alter table public.audit_logs drop constraint audit_logs_actor_id_fkey;
  end if;
  alter table public.audit_logs
    add constraint audit_logs_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

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
create index if not exists idx_return_requests_user on public.return_requests(user_id);
create index if not exists idx_return_requests_status on public.return_requests(status);

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
alter table public.return_requests enable row level security;

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
drop policy if exists "return_requests_read" on public.return_requests;
drop policy if exists "return_requests_student_insert" on public.return_requests;
drop policy if exists "return_requests_staff_manage" on public.return_requests;
drop policy if exists "notifications_read" on public.notifications;
drop policy if exists "notifications_update_self" on public.notifications;
drop policy if exists "notifications_staff_insert" on public.notifications;
drop policy if exists "notifications_delete_self" on public.notifications;
drop policy if exists "audit_logs_admin_read" on public.audit_logs;

create policy "profiles_select"
on public.profiles
for select
using (
  auth.uid() = id
  or coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com')
);

create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "profiles_admin_manage"
on public.profiles
for all
using (coalesce(auth.jwt() ->> 'email', '') = 'admin123@gmail.com')
with check (coalesce(auth.jwt() ->> 'email', '') = 'admin123@gmail.com');

create policy "branches_read"
on public.branches
for select
using (true);

create policy "branches_admin_manage"
on public.branches
for all
using (coalesce(auth.jwt() ->> 'email', '') = 'admin123@gmail.com')
with check (coalesce(auth.jwt() ->> 'email', '') = 'admin123@gmail.com');

create policy "books_read"
on public.books
for select
using (true);

create policy "books_staff_manage"
on public.books
for all
using (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'))
with check (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'));

create policy "book_branches_read"
on public.book_branches
for select
using (true);

create policy "book_branches_staff_manage"
on public.book_branches
for all
using (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'))
with check (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'));

create policy "transactions_student_read"
on public.transactions
for select
using (auth.uid() = user_id and status <> 'RETURNED');

create policy "transactions_staff_manage"
on public.transactions
for all
using (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'))
with check (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'));

create policy "reservations_student_insert"
on public.reservations
for insert
with check (auth.uid() = user_id and status = 'WAITING');

create policy "reservations_read"
on public.reservations
for select
using (
  coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com')
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
using (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'))
with check (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'));

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

create policy "return_requests_read"
on public.return_requests
for select
using (
  auth.uid() = user_id
  or coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com')
);

create policy "return_requests_student_insert"
on public.return_requests
for insert
with check (auth.uid() = user_id and status = 'PENDING');

create policy "return_requests_staff_manage"
on public.return_requests
for all
using (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'))
with check (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'));

create policy "notifications_read"
on public.notifications
for select
using (
  auth.uid() = user_id
  or coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com')
);

create policy "notifications_update_self"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notifications_delete_self"
on public.notifications
for delete
using (
  auth.uid() = user_id
  or coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com')
);

create policy "notifications_staff_insert"
on public.notifications
for insert
with check (coalesce(auth.jwt() ->> 'email', '') in ('admin123@gmail.com', 'librarian123@gmail.com'));

create policy "audit_logs_admin_read"
on public.audit_logs
for select
using (coalesce(auth.jwt() ->> 'email', '') = 'admin123@gmail.com');
