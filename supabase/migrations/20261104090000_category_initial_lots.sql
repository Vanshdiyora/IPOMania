alter table public.ipo_categories
  add column default_lots integer;
update public.ipo_categories
  set default_lots = coalesce(minimum_lots, 1);
alter table public.ipo_categories
  alter column default_lots set default 1,
  alter column default_lots set not null,
  add constraint ipo_categories_default_lots_valid check (
    default_lots > 0
    and (minimum_lots is null or default_lots >= minimum_lots)
    and (maximum_lots is null or default_lots <= maximum_lots)
    and mod(default_lots - coalesce(minimum_lots, 1), lot_increment) = 0
  );
grant insert (default_lots) on public.ipo_categories to authenticated;

alter table public.ipo_catalog_categories
  add column default_lots integer;
update public.ipo_catalog_categories
  set default_lots = coalesce(minimum_lots, 1);
alter table public.ipo_catalog_categories
  alter column default_lots set default 1,
  alter column default_lots set not null,
  add constraint ipo_catalog_categories_default_lots_valid check (
    default_lots > 0
    and (minimum_lots is null or default_lots >= minimum_lots)
    and (maximum_lots is null or default_lots <= maximum_lots)
    and mod(default_lots - coalesce(minimum_lots, 1), lot_increment) = 0
  );
grant insert (default_lots) on public.ipo_catalog_categories to authenticated;

comment on column public.ipo_categories.default_lots is
  'Configured starting lot quantity for new applications in this rule version.';
comment on column public.ipo_catalog_categories.default_lots is
  'Configured starting lot quantity for new applications in this rule version.';
