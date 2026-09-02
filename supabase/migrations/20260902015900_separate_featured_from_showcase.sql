-- The legacy `featured` flag originally powered both the home banner and the
-- "Destaques da casa" product section. Keep it as the single source of truth
-- for product highlights and give the independently managed banner its own
-- flag. Existing presentation is preserved by copying the current selection.
alter table public.products
  add column if not exists in_showcase boolean not null default false;

update public.products
set in_showcase = featured
where featured = true
  and in_showcase = false;

comment on column public.products.featured is
  'Controls whether the product appears in the Destaques da casa section.';

comment on column public.products.in_showcase is
  'Controls whether the product appears in the rotating home banner.';

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

  if cardinality(p_product_ids) <> cardinality(array(select distinct unnest(p_product_ids))) then
    raise exception 'O showcase não aceita produtos repetidos.';
  end if;

  if exists (
    select 1
    from unnest(p_product_ids) as requested(id)
    left join public.products product on product.id = requested.id
    where product.id is null or not product.is_available
  ) then
    raise exception 'O showcase aceita somente produtos ativos.';
  end if;

  update public.products
  set in_showcase = false,
      showcase_order = 0
  where in_showcase = true;

  update public.products product
  set in_showcase = true,
      showcase_order = requested.position - 1
  from unnest(p_product_ids) with ordinality as requested(id, position)
  where product.id = requested.id;
end;
$$;

revoke all on function public.set_showcase_products(text[]) from public, anon, authenticated;
grant execute on function public.set_showcase_products(text[]) to service_role;
