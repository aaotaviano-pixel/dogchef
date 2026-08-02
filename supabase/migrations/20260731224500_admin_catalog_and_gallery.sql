-- Full product editor, ordered showcase and product gallery.
alter table public.products
  add column if not exists highlight text,
  add column if not exists showcase_order integer not null default 0;

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  storage_path text,
  public_url text not null,
  is_main boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_order_idx
  on public.product_images(product_id, sort_order);

create unique index if not exists product_images_one_main_idx
  on public.product_images(product_id)
  where is_main;

alter table public.product_images enable row level security;
revoke all on public.product_images from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.set_showcase_products(p_product_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if cardinality(p_product_ids) > 5 then
    raise exception 'O showcase aceita no máximo 5 produtos.';
  end if;

  if exists (
    select 1
    from unnest(p_product_ids) as requested(id)
    left join public.products product on product.id = requested.id
    where product.id is null or not product.is_available
  ) then
    raise exception 'O showcase aceita somente produtos ativos.';
  end if;

  update public.products set featured = false;

  update public.products product
  set featured = true,
      showcase_order = requested.position - 1
  from unnest(p_product_ids) with ordinality as requested(id, position)
  where product.id = requested.id;
end;
$$;

revoke all on function public.set_showcase_products(text[]) from public, anon, authenticated;
grant execute on function public.set_showcase_products(text[]) to service_role;
