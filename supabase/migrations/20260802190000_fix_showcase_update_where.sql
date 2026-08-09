-- Supabase/Postgres may reject UPDATE statements without a WHERE clause.
-- Keep the showcase replacement atomic while updating only currently featured products.
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

  update public.products
  set featured = false
  where featured = true;

  update public.products product
  set featured = true,
      showcase_order = requested.position - 1
  from unnest(p_product_ids) with ordinality as requested(id, position)
  where product.id = requested.id;
end;
$$;

revoke all on function public.set_showcase_products(text[]) from public, anon, authenticated;
grant execute on function public.set_showcase_products(text[]) to service_role;
