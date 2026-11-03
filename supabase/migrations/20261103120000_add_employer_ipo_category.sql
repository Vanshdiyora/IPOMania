alter table public.ipo_categories
  drop constraint if exists ipo_categories_category_check;
alter table public.ipo_categories
  add constraint ipo_categories_category_check
  check (category in ('RETAIL', 'SHNI', 'BHNI', 'SHAREHOLDER', 'EMPLOYER'));

alter table public.ipo_quota_calculations
  drop constraint if exists ipo_quota_calculations_category_check;
alter table public.ipo_quota_calculations
  add constraint ipo_quota_calculations_category_check
  check (category in ('RETAIL', 'SHNI', 'BHNI', 'SHAREHOLDER', 'EMPLOYER'));
