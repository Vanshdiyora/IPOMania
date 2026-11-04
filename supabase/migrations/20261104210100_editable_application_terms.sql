-- Owners may revise the terms of a recorded application (category, lots, and price).
-- The API recomputes shares, amount, and the calculation snapshot from the new terms;
-- these columns remain owner-scoped through the existing RLS update policy.
grant update (
  category_id, category_code, lots, total_shares, application_amount, rule_version,
  calculation_snapshot
) on public.applications to authenticated;

comment on column public.applications.calculation_snapshot is
  'Saved calculation inputs and results. Replaced when an owner revises the category, lots, or price of the application.';
