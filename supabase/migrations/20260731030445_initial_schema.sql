-- DogChef production schema. All business mutations go through Next.js route handlers
-- using the server-side Supabase secret; the browser has no direct order access.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

do $$ begin
  create type public.order_status as enum ('pending_approval', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_status as enum ('not_required', 'awaiting_configuration', 'pending', 'approved', 'rejected', 'expired', 'cancelled', 'failed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.outbox_status as enum ('queued', 'leased', 'simulated', 'sent', 'failed', 'dead');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.print_job_status as enum ('queued', 'leased', 'printed', 'failed', 'dead');
exception when duplicate_object then null; end $$;

create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  timezone text not null default 'America/Sao_Paulo',
  accepting_orders boolean not null default true,
  require_pix_before_confirm boolean not null default true,
  minimum_order_cents integer not null default 0 check (minimum_order_cents >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  slot smallint not null default 1 check (slot between 1 and 3),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  unique (weekday, slot)
);

create table if not exists public.menu_categories (
  id text primary key,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_available boolean not null default true
);

create table if not exists public.products (
  id text primary key,
  category_id text not null references public.menu_categories(id),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  emoji text not null default '🍔',
  is_available boolean not null default true,
  featured boolean not null default false,
  prep_minutes integer not null default 20 check (prep_minutes >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_option_groups (
  id text primary key,
  name text not null,
  min_selections smallint not null default 0 check (min_selections >= 0),
  max_selections smallint not null default 1 check (max_selections >= min_selections),
  required boolean not null default false,
  is_available boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.product_option_group_products (
  product_id text not null references public.products(id) on delete restrict,
  option_group_id text not null references public.product_option_groups(id) on delete restrict,
  primary key (product_id, option_group_id)
);

create table if not exists public.product_options (
  id text primary key,
  option_group_id text not null references public.product_option_groups(id) on delete restrict,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.delivery_zones (
  id text primary key,
  name text not null,
  aliases text[] not null default '{}',
  fee_cents integer not null check (fee_cents >= 0),
  minimum_order_cents integer not null default 0 check (minimum_order_cents >= 0),
  is_available boolean not null default true,
  geojson jsonb
);

create table if not exists public.orders (
  id uuid primary key,
  public_code text not null unique,
  client_reference text not null unique,
  tracking_token_hash text not null,
  status public.order_status not null default 'pending_approval',
  payment_status public.payment_status not null default 'not_required',
  payment_method text not null check (payment_method in ('pix', 'cash', 'card')),
  delivery_type text not null check (delivery_type in ('delivery', 'pickup')),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  address jsonb,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  version bigint not null default 1,
  payment_data jsonb,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((delivery_type = 'pickup' and address is null) or (delivery_type = 'delivery' and address is not null))
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id text not null,
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 20),
  options jsonb not null default '[]'::jsonb,
  note text,
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  reason text,
  actor text not null check (actor in ('customer', 'admin', 'payment', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_payment_id text unique,
  provider_reference text unique,
  status public.payment_status not null default 'pending',
  idempotency_key text unique,
  pix_copy_paste text,
  expires_at timestamptz,
  redacted_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  request_id text,
  payment_id text,
  signature_valid boolean not null default false,
  payload_hash text not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, request_id),
  unique (provider, payload_hash)
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  channel text not null default 'whatsapp',
  event public.order_status not null,
  status public.outbox_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.print_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  token_hash text not null unique,
  token_prefix text not null,
  is_active boolean not null default true,
  capabilities jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  kind text not null default 'kitchen',
  status public.print_job_status not null default 'queued',
  payload jsonb not null,
  attempts integer not null default 0,
  lease_token text,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (order_id, kind)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);
create index if not exists orders_public_code_idx on public.orders (public_code);
create index if not exists order_events_order_created_at_idx on public.order_events (order_id, created_at desc);
create index if not exists payment_attempts_provider_payment_id_idx on public.payment_attempts (provider_payment_id);
create index if not exists print_jobs_queue_idx on public.print_jobs (status, lease_expires_at, created_at);
create index if not exists notification_outbox_queue_idx on public.notification_outbox (status, next_attempt_at);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$ begin new.updated_at = now(); return new; end $$;

create or replace function private.enforce_order_transition()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if new.status = old.status then return new; end if;
  if old.status = 'pending_approval' and new.status not in ('confirmed', 'cancelled') then raise exception 'invalid order transition'; end if;
  if old.status = 'confirmed' and new.status not in ('preparing', 'cancelled') then raise exception 'invalid order transition'; end if;
  if old.status = 'preparing' and new.status not in ('out_for_delivery', 'delivered', 'cancelled') then raise exception 'invalid order transition'; end if;
  if old.status = 'out_for_delivery' and new.status not in ('delivered', 'cancelled') then raise exception 'invalid order transition'; end if;
  if old.status in ('delivered', 'cancelled') then raise exception 'terminal order status'; end if;
  if new.status = 'out_for_delivery' and new.delivery_type <> 'delivery' then raise exception 'pickup orders cannot go out for delivery'; end if;
  if new.status = 'delivered' and old.status = 'preparing' and new.delivery_type <> 'pickup' then raise exception 'delivery orders must go out first'; end if;
  if new.status = 'confirmed' and new.payment_method = 'pix' and new.payment_status <> 'approved' then raise exception 'pix must be approved before confirmation'; end if;
  return new;
end $$;

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders for each row execute function private.touch_updated_at();
drop trigger if exists validate_order_transition on public.orders;
create trigger validate_order_transition before update of status on public.orders for each row execute function private.enforce_order_transition();
drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products for each row execute function private.touch_updated_at();
drop trigger if exists set_payment_attempts_updated_at on public.payment_attempts;
create trigger set_payment_attempts_updated_at before update on public.payment_attempts for each row execute function private.touch_updated_at();
drop trigger if exists set_notification_outbox_updated_at on public.notification_outbox;
create trigger set_notification_outbox_updated_at before update on public.notification_outbox for each row execute function private.touch_updated_at();

create or replace function public.claim_print_jobs(p_limit integer default 1)
returns table (id uuid, lease_token text, lease_expires_at timestamptz, payload jsonb)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  with candidates as (
    select pj.id from public.print_jobs pj
    where pj.status = 'queued' or (pj.status = 'leased' and pj.lease_expires_at < now())
    order by pj.created_at asc
    for update skip locked
    limit least(greatest(p_limit, 1), 3)
  )
  update public.print_jobs pj
  set status = 'leased', lease_token = encode(gen_random_bytes(24), 'hex'), lease_expires_at = now() + interval '60 seconds', attempts = pj.attempts + 1
  from candidates
  where pj.id = candidates.id
  returning pj.id, pj.lease_token, pj.lease_expires_at, pj.payload;
end $$;

revoke all on function public.claim_print_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_print_jobs(integer) to service_role;
revoke all on function private.touch_updated_at() from public;
revoke all on function private.enforce_order_transition() from public;

alter table public.store_settings enable row level security;
alter table public.working_hours enable row level security;
alter table public.menu_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.product_option_group_products enable row level security;
alter table public.product_options enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_webhook_deliveries enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.print_agents enable row level security;
alter table public.print_jobs enable row level security;
alter table public.audit_log enable row level security;
revoke all on all tables in schema public from anon, authenticated;

insert into public.store_settings (id) values (true) on conflict (id) do nothing;
insert into public.working_hours (weekday, slot, opens_at, closes_at, is_closed) values
  (0, 1, '18:00', '23:30', false), (1, 1, '18:00', '23:30', true), (2, 1, '18:00', '23:30', false),
  (3, 1, '18:00', '23:30', false), (4, 1, '18:00', '23:30', false), (5, 1, '18:00', '23:30', false),
  (6, 1, '18:00', '23:30', false)
on conflict (weekday, slot) do nothing;

insert into public.menu_categories (id, name, description, sort_order) values
  ('burgers', 'Burgers', 'Smash e artesanais', 1), ('dogs', 'Hot dogs', 'Clássicos da casa', 2),
  ('sides', 'Para dividir', 'Acompanhamentos', 3), ('drinks', 'Bebidas', 'Geladas', 4)
on conflict (id) do nothing;
insert into public.products (id, category_id, name, description, price_cents, emoji, featured, prep_minutes, sort_order) values
  ('dc-classic', 'burgers', 'DogChef Classic', 'Blend artesanal, cheddar cremoso, picles e molho da casa no pão brioche.', 2690, '🍔', true, 25, 1),
  ('dc-bacon', 'burgers', 'Bacon Melt', 'Dois smash burgers, cheddar, bacon crocante e cebola caramelizada.', 3290, '🥓', true, 30, 2),
  ('dc-chicken', 'burgers', 'Crispy Chicken', 'Frango crocante, coleslaw fresco, queijo e maionese picante.', 2790, '🍗', false, 25, 3),
  ('dc-dog', 'dogs', 'Dog do Chef', 'Salsicha artesanal, vinagrete, purê, milho, batata palha e molho especial.', 2090, '🌭', false, 20, 1),
  ('fries', 'sides', 'Batata Crocante', 'Porção generosa de batatas temperadas, douradas na medida.', 1390, '🍟', false, 15, 1),
  ('soda', 'drinks', 'Refrigerante gelado', 'Lata 350 ml. Escolha seu sabor favorito.', 650, '🥤', false, 2, 1)
on conflict (id) do nothing;
insert into public.delivery_zones (id, name, aliases, fee_cents, minimum_order_cents) values
  ('centro', 'Centro', array['centro', 'centro histórico'], 400, 2000),
  ('jardins', 'Jardins', array['jardins', 'jardim', 'vila nova'], 600, 2500),
  ('santa-rita', 'Santa Rita', array['santa rita', 'são francisco', 'sao francisco'], 800, 3000)
on conflict (id) do nothing;
