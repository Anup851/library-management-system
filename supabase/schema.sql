create table if not exists public.users (
  _id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'librarian', 'student')),
  "branchId" text,
  avatar text,
  phone text,
  "borrowingHistory" text[] not null default '{}',
  "createdAt" timestamptz not null default timezone('utc', now()),
  "passwordHash" text not null
);

create table if not exists public.branches (
  _id text primary key,
  name text not null,
  code text not null unique,
  address text not null
);

create table if not exists public.books (
  _id text primary key,
  title text not null,
  author text not null,
  category text not null,
  isbn text not null unique,
  barcode text not null unique,
  description text not null,
  "coverImage" text,
  "ebookUrl" text,
  "publishedYear" integer not null,
  language text not null,
  format text not null check (format in ('physical', 'digital', 'hybrid')),
  tags text[] not null default '{}',
  "branchIds" text[] not null default '{}',
  "totalCopies" integer not null default 0,
  "availableCopies" integer not null default 0,
  "ratingAverage" numeric(3, 1) not null default 0,
  "ratingCount" integer not null default 0,
  "createdAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  _id text primary key,
  "bookId" text not null,
  "userId" text not null,
  "branchId" text not null,
  "issuedBy" text not null,
  "returnedTo" text,
  "issuedAt" timestamptz not null,
  "dueDate" timestamptz not null,
  "returnedAt" timestamptz,
  "fineAmount" numeric(10, 2) not null default 0,
  status text not null check (status in ('ISSUED', 'RETURNED', 'OVERDUE'))
);

create table if not exists public.reservations (
  _id text primary key,
  "bookId" text not null,
  "userId" text not null,
  status text not null check (status in ('WAITING', 'READY', 'FULFILLED', 'CANCELLED')),
  position integer not null,
  "createdAt" timestamptz not null,
  "notifiedAt" timestamptz
);

create table if not exists public.reviews (
  _id text primary key,
  "bookId" text not null,
  "userId" text not null,
  rating numeric(2, 1) not null,
  comment text not null,
  "createdAt" timestamptz not null
);

create table if not exists public.notifications (
  _id text primary key,
  "userId" text not null,
  title text not null,
  message text not null,
  channel text not null check (channel in ('email', 'sms', 'in_app')),
  read boolean not null default false,
  "createdAt" timestamptz not null
);

create table if not exists public.audit_logs (
  _id text primary key,
  "actorId" text not null,
  action text not null,
  entity text not null,
  "entityId" text not null,
  details jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null
);

create index if not exists idx_books_category on public.books (category);
create index if not exists idx_transactions_user_id on public.transactions ("userId");
create index if not exists idx_transactions_book_id on public.transactions ("bookId");
create index if not exists idx_reservations_book_id on public.reservations ("bookId");
create index if not exists idx_notifications_user_id on public.notifications ("userId");
