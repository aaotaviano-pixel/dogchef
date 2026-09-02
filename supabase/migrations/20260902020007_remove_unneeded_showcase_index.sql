-- The catalog is small and loaded in menu order, then its banner selection is
-- sorted in application memory. A partial showcase index would add write cost
-- without serving any database query.
drop index if exists public.products_showcase_order_idx;
