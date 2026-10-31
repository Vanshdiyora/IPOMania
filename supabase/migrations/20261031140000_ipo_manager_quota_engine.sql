create table public.ipos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_name text not null check (char_length(btrim(company_name)) between 1 and 160),
  symbol text not null check (symbol = upper(btrim(symbol)) and char_length(symbol) between 1 and 24),
  ipo_type text not null check (char_length(btrim(ipo_type)) between 1 and 40),
  exchange text not null check (char_length(btrim(exchange)) between 1 and 40),
  issue_price_min numeric(18, 6) not null check (issue_price_min > 0),
  issue_price_max numeric(18, 6) not null check (issue_price_max >= issue_price_min),
  cut_off_price numeric(18, 6),
  lot_size integer not null check (lot_size > 0),
  issue_size numeric(24, 4) not null check (issue_size > 0),
  opening_date date not null,
  closing_date date not null check (closing_date >= opening_date),
  allotment_date date,
  listing_date date,
  status text not null check (
    status in ('UPCOMING', 'OPEN', 'CLOSED', 'ALLOTMENT_PENDING', 'LISTED', 'WITHDRAWN')
  ),
  data_source text not null default 'MANUAL'
    check (data_source in ('MANUAL', 'PUBLISHED_SOURCE')),
  source_reference text check (source_reference is null or char_length(source_reference) <= 1000),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ipos_cut_off_in_issue_range
    check (cut_off_price is null or cut_off_price between issue_price_min and issue_price_max),
  constraint ipos_user_symbol_unique unique (user_id, symbol),
  constraint ipos_id_user_unique unique (id, user_id)
);

create index ipos_owner_opening_date_idx
  on public.ipos (user_id, opening_date, id)
  where archived_at is null;
create index ipos_owner_status_idx
  on public.ipos (user_id, status, opening_date)
  where archived_at is null;
create index ipos_owner_company_trgm_idx
  on public.ipos using gin (company_name extensions.gin_trgm_ops);

create trigger ipos_set_updated_at
  before update on public.ipos
  for each row execute function public.set_updated_at();

create function public.is_valid_ipo_eligibility_conditions(p_conditions jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  condition jsonb;
  condition_id text;
  seen_ids text[] := array[]::text[];
begin
  if pg_catalog.jsonb_typeof(p_conditions) <> 'array'
    or pg_catalog.jsonb_array_length(p_conditions) > 20 then
    return false;
  end if;

  for condition in select value from pg_catalog.jsonb_array_elements(p_conditions)
  loop
    if pg_catalog.jsonb_typeof(condition) <> 'object'
      or condition - 'id' - 'description' <> '{}'::jsonb
      or (
        select pg_catalog.count(*)
        from pg_catalog.jsonb_object_keys(condition)
      ) <> 2
      or pg_catalog.jsonb_typeof(condition->'id') <> 'string'
      or pg_catalog.jsonb_typeof(condition->'description') <> 'string' then
      return false;
    end if;
    condition_id := condition->>'id';
    if condition_id !~ '^[A-Za-z0-9_-]{1,40}$'
      or pg_catalog.char_length(pg_catalog.btrim(condition->>'description')) not between 1 and 500
      or condition_id = any(seen_ids) then
      return false;
    end if;
    seen_ids := pg_catalog.array_append(seen_ids, condition_id);
  end loop;
  return true;
end;
$$;

create table public.ipo_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ipo_id uuid not null,
  category text not null check (category in ('RETAIL', 'SHNI', 'BHNI', 'SHAREHOLDER')),
  rule_version integer not null check (rule_version > 0),
  lot_limit_status text not null
    check (lot_limit_status in ('CONFIGURED', 'NO_PUBLISHED_LIMIT', 'UNCONFIGURED')),
  minimum_lots integer check (minimum_lots is null or minimum_lots > 0),
  maximum_lots integer check (maximum_lots is null or maximum_lots > 0),
  lot_increment integer not null check (lot_increment > 0),
  investment_limit_status text not null
    check (investment_limit_status in ('CONFIGURED', 'NO_PUBLISHED_LIMIT', 'UNCONFIGURED')),
  minimum_investment numeric(24, 4) check (minimum_investment is null or minimum_investment > 0),
  maximum_investment numeric(24, 4) check (maximum_investment is null or maximum_investment > 0),
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
  constraint ipo_categories_ipo_owner_fk
    foreign key (ipo_id, user_id) references public.ipos (id, user_id) on delete cascade,
  constraint ipo_categories_rule_version_unique unique (ipo_id, category, rule_version),
  constraint ipo_categories_id_user_unique unique (id, user_id),
  constraint ipo_categories_id_category_version_unique unique (id, category, rule_version),
  constraint ipo_categories_lot_status_values check (
    (lot_limit_status = 'CONFIGURED' and (minimum_lots is not null or maximum_lots is not null))
    or (lot_limit_status <> 'CONFIGURED' and minimum_lots is null and maximum_lots is null)
  ),
  constraint ipo_categories_investment_status_values check (
    (investment_limit_status = 'CONFIGURED'
      and (minimum_investment is not null or maximum_investment is not null))
    or (investment_limit_status <> 'CONFIGURED'
      and minimum_investment is null and maximum_investment is null)
  ),
  constraint ipo_categories_lot_bounds check (
    minimum_lots is null or maximum_lots is null or minimum_lots <= maximum_lots
  ),
  constraint ipo_categories_investment_bounds check (
    minimum_investment is null or maximum_investment is null
    or minimum_investment <= maximum_investment
  ),
  constraint ipo_categories_record_date_required check (
    minimum_shareholding is null or shareholder_record_date is not null
  )
);

create index ipo_categories_owner_issue_idx on public.ipo_categories (user_id, ipo_id, category);

create function public.assign_ipo_category_rule_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text || ':' || new.ipo_id::text || ':' || new.category, 0)
  );
  select coalesce(max(rule_version), 0) + 1
  into new.rule_version
  from public.ipo_categories
  where user_id = new.user_id and ipo_id = new.ipo_id and category = new.category;
  return new;
end;
$$;

revoke execute on function public.assign_ipo_category_rule_version() from public, anon, authenticated;

create trigger ipo_categories_assign_rule_version
  before insert on public.ipo_categories
  for each row execute function public.assign_ipo_category_rule_version();

create unique index demat_accounts_id_user_unique_idx
  on public.demat_accounts (id, user_id);

create table public.ipo_quota_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ipo_id uuid not null,
  category_configuration_id uuid not null,
  demat_account_id uuid,
  category text not null check (category in ('RETAIL', 'SHNI', 'BHNI', 'SHAREHOLDER')),
  rule_version integer not null check (rule_version > 0),
  calculation_timestamp timestamptz not null default now(),
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  constraint ipo_quota_calculations_owner_ipo_fk
    foreign key (ipo_id, user_id) references public.ipos (id, user_id) on delete restrict,
  constraint ipo_quota_calculations_owner_rules_fk
    foreign key (category_configuration_id, user_id)
    references public.ipo_categories (id, user_id) on delete restrict,
  constraint ipo_quota_calculations_owner_account_fk
    foreign key (demat_account_id, user_id)
    references public.demat_accounts (id, user_id) on delete restrict,
  constraint ipo_quota_calculations_category_version_fk
    foreign key (category_configuration_id, category, rule_version)
    references public.ipo_categories (id, category, rule_version) on delete restrict
);

create index ipo_quota_calculations_owner_created_idx
  on public.ipo_quota_calculations (user_id, calculation_timestamp desc, id);

alter table public.ipos enable row level security;
alter table public.ipos force row level security;
alter table public.ipo_categories enable row level security;
alter table public.ipo_categories force row level security;
alter table public.ipo_quota_calculations enable row level security;
alter table public.ipo_quota_calculations force row level security;

create policy "Users manage their own IPO records"
  on public.ipos for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users read their own IPO category rule versions"
  on public.ipo_categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own IPO category rule versions"
  on public.ipo_categories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users read their own quota calculation history"
  on public.ipo_quota_calculations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own quota calculations"
  on public.ipo_quota_calculations for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.ipos, public.ipo_categories, public.ipo_quota_calculations
  from public, anon, authenticated;
revoke execute on function public.is_valid_ipo_eligibility_conditions(jsonb)
  from public, anon;
grant execute on function public.is_valid_ipo_eligibility_conditions(jsonb) to authenticated;
grant select on public.ipos to authenticated;
grant insert (
  user_id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
  cut_off_price, lot_size, issue_size, opening_date, closing_date, allotment_date,
  listing_date, status, data_source, source_reference, last_verified_at
) on public.ipos to authenticated;
grant update (
  company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
  cut_off_price, lot_size, issue_size, opening_date, closing_date, allotment_date,
  listing_date, status, data_source, source_reference, last_verified_at, archived_at
) on public.ipos to authenticated;
grant select on public.ipo_categories to authenticated;
grant insert (
  user_id, ipo_id, category, lot_limit_status, minimum_lots, maximum_lots,
  lot_increment, investment_limit_status, minimum_investment, maximum_investment,
  reserved_shares, reserved_percentage, shareholder_record_date, minimum_shareholding,
  eligibility_conditions, allowed_price_types, minimum_price_increment, source_reference,
  rule_source, last_verified_at
) on public.ipo_categories to authenticated;
grant select, insert (
  user_id, ipo_id, category_configuration_id, demat_account_id, category, rule_version,
  input_snapshot, result_snapshot
) on public.ipo_quota_calculations to authenticated;

comment on table public.ipos is
  'User-owned manual IPO records. No shared editorial roles exist yet; RLS isolates every record.';
comment on table public.ipo_categories is
  'Append-only, issue-specific rule versions. Add a new version instead of changing history.';
comment on table public.ipo_quota_calculations is
  'User-owned immutable snapshots for reproducing historical quota calculations.';
comment on column public.ipo_categories.lot_limit_status is
  'Distinguishes explicit limits, no published limit, and not-yet-configured rules.';
comment on column public.ipo_categories.investment_limit_status is
  'Distinguishes explicit investment bounds, no published limit, and unknown rules.';
