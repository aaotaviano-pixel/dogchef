-- Canonical Dog do Chef catalog transcribed from the published menu PDF.
-- `featured = true` preserves the menu highlights: "Mais pedido" and
-- "Melhor escolha". Existing demo rows are only disabled, never deleted.

with incoming_categories (id, name, description, sort_order) as (
  values
    ('tradicionais', 'Tradicionais', 'Hot dogs clássicos da casa.', 1),
    ('prensadoes', 'Prensadões', 'Hot dogs prensados na chapa.', 2),
    ('combos', 'Combos', 'Combinações prontas para aproveitar.', 3),
    ('dog-no-pote', 'Dog no Pote (Gratinados)', 'Gratinados servidos no pote.', 4),
    ('porcoes', 'Porções', 'Acompanhamentos para compartilhar.', 5),
    ('bebidas', 'Bebidas', 'Opções geladas e naturais.', 6)
)
insert into public.menu_categories (id, name, description, sort_order, is_available)
select id, name, description, sort_order, true
from incoming_categories
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_available = excluded.is_available;

with incoming_products (id, category_id, name, description, price_cents, emoji, featured, prep_minutes, sort_order) as (
  values
    -- Tradicionais
    ('tradicional-hot-dog-tradicional', 'tradicionais', 'Hot Dog Tradicional', 'Pão, molhos, purê, salsicha Perdigão e batata palha.', 1300, '🌭', false, 15, 1),
    ('tradicional-hot-dog-duplo', 'tradicionais', 'Hot Dog Duplo', 'Pão, molhos, molho de alho, purê, 2 salsichas Perdigão, milho e batata palha.', 1800, '🌭', false, 15, 2),
    ('tradicional-hot-dog-bacon', 'tradicionais', 'Hot Dog Bacon', 'Pão, molhos, molho de alho, purê, salsichas Perdigão, bacon, milho e batata palha.', 2100, '🌭', false, 15, 3),
    ('tradicional-hot-dog-calabresa', 'tradicionais', 'Hot Dog Calabresa', 'Pão, molhos, molho de alho, purê, calabresa, salsichas Perdigão, milho e batata palha.', 2100, '🌭', false, 15, 4),

    -- Prensadões
    ('prensado-hot-dog-tradicional', 'prensadoes', 'Hot Dog Tradicional', 'Pão, molhos, molho de alho, purê, vinagrete e batata palha.', 1600, '🌭', false, 20, 1),
    ('prensado-hot-dog-duplo', 'prensadoes', 'Hot Dog Duplo', 'Pão, molhos, molho de alho, purê, vinagrete, 2 salsichas Perdigão, batata palha e milho.', 2000, '🌭', false, 20, 2),
    ('prensado-hot-dog-catupiry', 'prensadoes', 'Hot Dog Catupiry', 'Pão, molhos, molho de alho, purê, vinagrete, salsicha Perdigão, catupiry Scala, milho e batata palha.', 2200, '🌭', false, 20, 3),
    ('prensado-hot-dog-cheddar', 'prensadoes', 'Hot Dog Cheddar', 'Pão, molhos, molho de alho, purê, vinagrete, salsicha Perdigão, cheddar Scala, milho e batata palha.', 2200, '🌭', false, 20, 4),
    ('prensado-hot-dog-calabresa', 'prensadoes', 'Hot Dog Calabresa', 'Pão, molhos, molho de alho, purê, vinagrete, salsicha Perdigão, calabresa, milho e batata palha.', 2300, '🌭', false, 20, 5),
    ('prensado-alcatra', 'prensadoes', 'Prensadão Alcatra', 'Pão, molhos, molho de alho, purê, vinagrete, mussarela, alcatra fatiada, salsicha Perdigão, milho e batata palha.', 2500, '🌭', false, 20, 6),
    ('prensado-dog-do-chef', 'prensadoes', 'Dog do Chef', 'Pão, molhos, molho de alho, purê, vinagrete, 2 salsichas Perdigão, bacon, catupiry Scala, mussarela, milho e batata palha.', 3000, '🌭', false, 20, 7),
    ('prensado-dog-monstro', 'prensadoes', 'Dog Monstro', 'Pão, molhos, molho de alho, purê, vinagrete, 2 salsichas Perdigão, alcatra, bacon, calabresa, catupiry ou cheddar Scala, mussarela, milho e batata palha.', 3800, '🌭', false, 25, 8),
    ('prensado-picanha', 'prensadoes', 'Prensadão Picanha', 'Pão, molhos, molho de alho, purê, vinagrete, mussarela, picanha fatiada, milho e batata palha.', 4000, '🌭', false, 25, 9),

    -- Combos
    ('combo-tradicional', 'combos', 'Combo Tradicional', '1 Hot Dog Tradicional; 1 Refrigerante Lata.', 1800, '🌭', false, 20, 1),
    ('combo-simples', 'combos', 'Combo Simples', '1 Hot Dog Simples Prensado; 1 Refrigerante Lata.', 2300, '🌭', false, 20, 2),
    ('combo-do-chef', 'combos', 'Combo do Chef', '2 Dog do Chef; 2 Refrigerante Lata.', 6800, '⭐', true, 25, 3),
    ('combo-completo', 'combos', 'Combo Completo', '2 Hot Dog Duplo Prensado; porção de batata frita simples; 1 Refrigerante 600 ml.', 7500, '👑', true, 25, 4),

    -- Dog no Pote (Gratinados)
    ('gratinado-simples', 'dog-no-pote', 'Gratinado Simples', 'Pão, salsicha Perdigão, purê, batata palha, ketchup, mostarda e mussarela gratinada.', 1800, '🥘', false, 25, 1),
    ('gratinado-especial', 'dog-no-pote', 'Gratinado Especial', 'Pão, 2 salsichas Perdigão, purê, milho, vinagrete, batata palha, molho de alho, ketchup, mostarda e mussarela gratinada.', 2200, '🥘', false, 25, 2),
    ('gratinado-bacon-especial', 'dog-no-pote', 'Gratinado Bacon Especial', 'Pão, 2 salsichas Perdigão, purê, milho, vinagrete, batata palha, bacon, catupiry, molho de alho, ketchup, mostarda e mussarela gratinada.', 2800, '🥘', false, 25, 3),
    ('gratinado-calabresa-especial', 'dog-no-pote', 'Gratinado Calabresa Especial', 'Pão, 2 salsichas Perdigão, purê, milho, vinagrete, batata palha, calabresa, catupiry, molho de alho, ketchup, mostarda e mussarela gratinada.', 2800, '🥘', false, 25, 4),

    -- Porções
    ('porcao-batata-simples', 'porcoes', 'Porção de Batata Simples', '', 3500, '🍟', false, 18, 1),
    ('porcao-batata-completa', 'porcoes', 'Porção de Batata Completa', 'Batata, Catupiry ou Cheddar Scalla, bacon e mussarela.', 4500, '🍟', false, 18, 2),

    -- Bebidas
    ('bebida-refrigerante-lata', 'bebidas', 'Refrigerante Lata', '', 600, '🥤', false, 2, 1),
    ('bebida-coca-cola-1-litro', 'bebidas', 'Coca-Cola 1 Litro', '', 1100, '🥤', false, 2, 2),
    ('bebida-suco-del-valle-lata', 'bebidas', 'Suco Del Valle Lata', '', 800, '🧃', false, 2, 3),
    ('bebida-agua-sem-gas', 'bebidas', 'Água sem gás', '', 350, '💧', false, 2, 4),
    ('bebida-agua-com-gas', 'bebidas', 'Água com gás', '', 350, '💧', false, 2, 5),
    ('bebida-refrigerante-600-ml', 'bebidas', 'Refrigerante 600 ml', '', 900, '🥤', false, 2, 6),
    ('bebida-cerveja-600-ml', 'bebidas', 'Cerveja 600 ml', '', 1200, '🍺', false, 2, 7),
    ('bebida-suco-laranja-jarra-500-ml', 'bebidas', 'Suco Laranja Natural — Jarra 500 ml', '', 1500, '🍊', false, 3, 8),
    ('bebida-suco-laranja-copo-300-ml', 'bebidas', 'Suco Laranja Natural — Copo 300 ml', '', 800, '🍊', false, 3, 9)
)
insert into public.products (
  id,
  category_id,
  name,
  description,
  price_cents,
  emoji,
  is_available,
  featured,
  prep_minutes,
  sort_order
)
select
  id,
  category_id,
  name,
  description,
  price_cents,
  emoji,
  true,
  featured,
  prep_minutes,
  sort_order
from incoming_products
on conflict (id) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  emoji = excluded.emoji,
  is_available = excluded.is_available,
  featured = excluded.featured,
  prep_minutes = excluded.prep_minutes,
  sort_order = excluded.sort_order;

-- Retain the original demo catalog for audit/history without exposing it as sellable.
update public.products
set is_available = false
where id in ('dc-classic', 'dc-bacon', 'dc-chicken', 'dc-dog', 'fries', 'soda');

update public.menu_categories
set is_available = false
where id in ('burgers', 'dogs', 'sides', 'drinks');

-- The Next.js server talks to Supabase with the server-only secret key.
-- Keep browser roles revoked; grant the minimum database access to service_role.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
