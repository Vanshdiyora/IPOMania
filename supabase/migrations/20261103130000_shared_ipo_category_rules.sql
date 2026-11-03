create table public.ipo_catalog_categories (
  id uuid primary key default gen_random_uuid(),
  ipo_catalog_id uuid not null references public.ipo_catalog(id) on delete restrict,
  category text not null check (
    category in ('RETAIL', 'SHNI', 'BHNI', 'SHAREHOLDER', 'EMPLOYER')
  ),
  rule_version integer not null check (rule_version > 0),
  lot_limit_status text not null
    check (lot_limit_status in ('CONFIGURED', 'NO_PUBLISHED_LIMIT', 'UNCONFIGURED')),
  minimum_lots integer check (minimum_lots is null or minimum_lots > 0),
  maximum_lots integer check (maximum_lots is null or maximum_lots > 0),
  lot_increment integer not null check (lot_increment > 0),
  investment_limit_status text not null
    check (investment_limit_status in ('CONFIGURED', 'NO_PUBLISHED_LIMIT', 'UNCONFIGURED')),
  minimum_investment numeric(24, 4)
    check (minimum_investment is null or minimum_investment > 0),
  maximum_investment numeric(24, 4)
    check (maximum_investment is null or maximum_investment > 0),
  reserved_shares bigint check (reserved_shares is null or reserved_shares > 0),
  reserved_percentage numeric(9, 6)
    check (reserved_percentage is null or reserved_percentage between 0 and 100),
  shareholder_record_date date,
  minimum_shareholding bigint check (minimum_shareholding is null or minimum_shareholding > 0),
  eligibility_conditions jsonb not null default '[]'::jsonb
    check (public.is_valid_ipo_eligibility_conditions(eligibility_conditions)),
  allowed_price_types text[] not null
    check (
      cardinality(allowed_price_types) between 1 and 2
      and allowed_price_types <@ array['BID', 'CUT_OFF']::text[]
      and array_ndims(allowed_price_types) = 1
      and (
        cardinality(allowed_price_types) = 1
        or allowed_price_types[1] <> allowed_price_types[2]
      )
    ),
  minimum_price_increment numeric(18, 6)
    check (minimum_price_increment is null or minimum_price_increment > 0),
  source_reference text check (source_reference is null or char_length(source_reference) <= 1000),
  rule_source text not null default 'MANUAL'
    check (rule_source in ('MANUAL', 'PUBLISHED_SOURCE')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ipo_catalog_categories_rule_version_unique
    unique (ipo_catalog_id, category, rule_version),
  constraint ipo_catalog_categories_lot_status_values check (
    (lot_limit_status = 'CONFIGURED' and (minimum_lots is not null or maximum_lots is not null))
    or (lot_limit_status <> 'CONFIGURED' and minimum_lots is null and maximum_lots is null)
  ),
  constraint ipo_catalog_categories_investment_status_values check (
    (investment_limit_status = 'CONFIGURED'
      and (minimum_investment is not null or maximum_investment is not null))
    or (investment_limit_status <> 'CONFIGURED'
      and minimum_investment is null and maximum_investment is null)
  ),
  constraint ipo_catalog_categories_lot_bounds check (
    minimum_lots is null or maximum_lots is null or minimum_lots <= maximum_lots
  ),
  constraint ipo_catalog_categories_investment_bounds check (
    minimum_investment is null or maximum_investment is null
    or minimum_investment <= maximum_investment
  ),
  constraint ipo_catalog_categories_record_date_required check (
    minimum_shareholding is null or shareholder_record_date is not null
  )
);

create function public.assign_ipo_catalog_category_rule_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.ipo_catalog_id::text || ':' || new.category,
      0
    )
  );
  select coalesce(max(rule_version), 0) + 1
  into new.rule_version
  from public.ipo_catalog_categories
  where ipo_catalog_id = new.ipo_catalog_id and category = new.category;
  return new;
end;
$$;

revoke execute on function public.assign_ipo_catalog_category_rule_version() from public, anon, authenticated;

create trigger ipo_catalog_categories_assign_rule_version
  before insert on public.ipo_catalog_categories
  for each row execute function public.assign_ipo_catalog_category_rule_version();
create index ipo_catalog_categories_issue_version_idx
  on public.ipo_catalog_categories (ipo_catalog_id, category, rule_version desc);

alter table public.ipo_catalog_categories enable row level security;
alter table public.ipo_catalog_categories force row level security;

create policy "Users can read rules for active catalog IPOs"
  on public.ipo_catalog_categories for select to authenticated
  using (
    exists (
      select 1
      from public.ipo_catalog
      where id = ipo_catalog_id and archived_at is null
    )
  );
create policy "Admins create shared catalog category rules"
  on public.ipo_catalog_categories for insert to authenticated
  with check (public.is_admin());

revoke all on public.ipo_catalog_categories from public, anon, authenticated;
grant select on public.ipo_catalog_categories to authenticated;
grant insert (
  ipo_catalog_id, category, lot_limit_status, minimum_lots, maximum_lots,
  lot_increment, investment_limit_status, minimum_investment, maximum_investment,
  reserved_shares, reserved_percentage, shareholder_record_date, minimum_shareholding,
  eligibility_conditions, allowed_price_types, minimum_price_increment, source_reference,
  rule_source, last_verified_at
) on public.ipo_catalog_categories to authenticated;

alter table public.ipos
  add column source_catalog_id uuid references public.ipo_catalog(id) on delete restrict;

create unique index ipos_user_catalog_source_unique
  on public.ipos (user_id, source_catalog_id)
  where source_catalog_id is not null;

alter table public.ipo_categories
  add column source_catalog_rule_id uuid
    references public.ipo_catalog_categories(id) on delete restrict;

grant insert (source_catalog_id) on public.ipos to authenticated;
grant insert (source_catalog_rule_id) on public.ipo_categories to authenticated;

comment on table public.ipo_catalog_categories is
  'Append-only, admin-managed, source-backed quota category rules for shared catalog IPOs.';
