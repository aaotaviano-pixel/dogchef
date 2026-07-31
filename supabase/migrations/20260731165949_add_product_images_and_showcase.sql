-- Product photography used by both the storefront cards and the admin-selected
-- showcase. Existing products and order history are preserved.
alter table public.products
add column if not exists image_url text not null default '';

update public.products
set image_url = case
  when category_id = 'dog-no-pote' then '/images/dogchef/dog-no-pote.webp'
  when category_id = 'porcoes' then '/images/dogchef/batata-completa.webp'
  when category_id = 'bebidas' then '/images/dogchef/bebidas.webp'
  when category_id = 'combos' then '/images/dogchef/hero-dog-do-chef.webp'
  when id in ('prensado-alcatra', 'prensado-dog-monstro', 'prensado-picanha') then '/images/dogchef/dog-monstro.webp'
  when id like '%bacon%' or id like '%calabresa%' then '/images/dogchef/dog-monstro.webp'
  when category_id = 'prensadoes' then '/images/dogchef/hot-dog-cremoso.webp'
  else '/images/dogchef/hot-dog-tradicional.webp'
end
where image_url = '' or image_url is null;
