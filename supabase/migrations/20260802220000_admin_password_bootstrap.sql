-- Existing environments may already have admin_settings without the bootstrap marker.
alter table public.admin_settings
  add column if not exists bootstrap_used boolean not null default false;

update public.admin_settings
set bootstrap_used = false
where id = true;
