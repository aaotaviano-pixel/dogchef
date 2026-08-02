create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (char_length(phone) between 10 and 20),
  email text not null check (char_length(email) between 3 and 120),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_accounts_email_lower_idx
  on public.customer_accounts (lower(email));

alter table public.orders
  add column if not exists customer_id uuid references public.customer_accounts(id) on delete set null;

create index if not exists orders_customer_created_at_idx
  on public.orders (customer_id, created_at desc)
  where customer_id is not null;

alter table public.customer_accounts enable row level security;

revoke all on table public.customer_accounts from anon, authenticated;
