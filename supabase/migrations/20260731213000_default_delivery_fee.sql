alter table public.store_settings
add column if not exists default_delivery_fee_cents integer not null default 800
check (default_delivery_fee_cents >= 0);

update public.store_settings
set default_delivery_fee_cents = 800,
    updated_at = now()
where id = true;

-- These rows belong to the original demonstration catalog. New rows are
-- explicit neighborhood overrides managed by the administrator.
update public.delivery_zones
set is_available = false
where id in ('centro', 'jardins', 'santa-rita');
