-- Allow an authenticated local print agent to receive a diagnostic ticket without
-- creating a fake order. Existing order-backed print jobs remain unchanged.
alter table public.print_jobs
  alter column order_id drop not null;

comment on column public.print_jobs.order_id is
  'Null only for kind=test diagnostic print jobs; order-backed jobs keep the FK.';
