-- Stores only a salted password hash for the administrator password change flow.
create table if not exists public.admin_settings (
  id boolean primary key default true check (id),
  password_hash text,
  bootstrap_used boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;
revoke all on table public.admin_settings from public, anon, authenticated;
grant select, insert, update on table public.admin_settings to service_role;
