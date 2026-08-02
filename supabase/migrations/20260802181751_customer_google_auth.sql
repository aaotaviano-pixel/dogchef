alter table public.customer_accounts
  alter column phone drop not null,
  alter column password_hash drop not null,
  add column if not exists auth_user_id uuid;

create unique index if not exists customer_accounts_auth_user_id_idx
  on public.customer_accounts (auth_user_id)
  where auth_user_id is not null;

alter table public.customer_accounts
  drop constraint if exists customer_accounts_auth_method_check;

alter table public.customer_accounts
  add constraint customer_accounts_auth_method_check
  check (password_hash is not null or auth_user_id is not null) not valid;

alter table public.customer_accounts
  validate constraint customer_accounts_auth_method_check;

revoke all on table public.customer_accounts from anon, authenticated;
