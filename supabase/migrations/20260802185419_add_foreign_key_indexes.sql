-- Cover foreign-key lookups used by order, catalog, and notification flows.
create index if not exists products_category_id_idx
  on public.products (category_id);

create index if not exists product_options_option_group_id_idx
  on public.product_options (option_group_id);

create index if not exists product_option_group_products_option_group_id_idx
  on public.product_option_group_products (option_group_id);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

create index if not exists payment_attempts_order_id_idx
  on public.payment_attempts (order_id);

create index if not exists notification_outbox_order_id_idx
  on public.notification_outbox (order_id);
