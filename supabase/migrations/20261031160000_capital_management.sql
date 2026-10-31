create unique index ipo_quota_calculations_id_user_unique_idx
  on public.ipo_quota_calculations (id, user_id);

alter table public.applications
  add column category_configuration_id uuid,
  add column quota_calculation_id uuid,
  add column category text check (category in ('RETAIL', 'SHNI', 'BHNI', 'SHAREHOLDER')),
  add column lot_size integer check (lot_size is null or lot_size > 0),
  add column issue_price_min numeric(18, 6) check (issue_price_min is null or issue_price_min > 0),
  add column issue_price_max numeric(18, 6),
  add column cut_off_price numeric(18, 6),
  add column shares bigint,
  add column price_type text check (price_type in ('BID', 'CUT_OFF')),
  add column price numeric(18, 6),
  add column currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$');

alter table public.applications
  add constraint applications_owner_rules_fk
    foreign key (category_configuration_id, ipo_id, user_id)
    references public.ipo_categories (id, ipo_id, user_id) on delete restrict,
  add constraint applications_category_version_fk
    foreign key (category_configuration_id, category, rule_version)
    references public.ipo_categories (id, category, rule_version) on delete restrict,
  add constraint applications_owner_calculation_fk
    foreign key (quota_calculation_id, user_id)
    references public.ipo_quota_calculations (id, user_id) on delete restrict,
  add constraint applications_calculation_unique unique (quota_calculation_id),
  add constraint applications_capital_fields_check check (
    (quota_calculation_id is null and category_configuration_id is null and category is null
      and lot_size is null and issue_price_min is null and issue_price_max is null
      and cut_off_price is null and shares is null and price_type is null and price is null)
    or
    (quota_calculation_id is not null and category_configuration_id is not null
      and category is not null and lot_size is not null and issue_price_min is not null
      and issue_price_max is not null and shares is not null and price_type is not null
      and price is not null)
  ),
  add constraint applications_capital_cut_off_price_check
    check (cut_off_price is null or cut_off_price between issue_price_min and issue_price_max),
  add constraint applications_capital_values_check check (
    (quota_calculation_id is null)
    or (lots > 0 and shares > 0 and price > 0 and application_amount > 0
      and issue_price_max >= issue_price_min)
  );

create index applications_owner_ipo_idx
  on public.applications (user_id, ipo_id, created_at desc);
create index applications_owner_account_idx
  on public.applications (user_id, demat_account_id, created_at desc);

create function public.populate_capital_application_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.quota_calculation_id is not null then
    new.category_id := coalesce(new.category_id, new.category_configuration_id);
    new.total_shares := coalesce(new.total_shares, new.shares);
    new.calculation_snapshot := coalesce(
      new.calculation_snapshot,
      pg_catalog.jsonb_build_object(
        'quota_calculation_id', new.quota_calculation_id,
        'category', new.category,
        'lots', new.lots,
        'shares', new.shares,
        'price_type', new.price_type,
        'price', new.price
      )
    );
  end if;
  return new;
end;
$$;

create trigger applications_populate_capital_fields
  before insert on public.applications
  for each row execute function public.populate_capital_application_fields();

create table public.mandates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  mandate_reference text not null check (char_length(btrim(mandate_reference)) between 1 and 160),
  mandate_amount numeric(38, 6) not null check (mandate_amount > 0),
  mandate_status text not null default 'PENDING'
    check (mandate_status in ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED', 'RELEASED')),
  blocked_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint mandates_owner_application_fk
    foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete restrict,
  constraint mandates_reference_unique unique (user_id, mandate_reference),
  constraint mandates_application_unique unique (application_id),
  constraint mandates_id_user_unique unique (id, user_id)
);

create index mandates_owner_status_idx
  on public.mandates (user_id, mandate_status, updated_at desc);

create trigger mandates_set_updated_at
  before update on public.mandates
  for each row execute function public.set_updated_at();

create table public.allotments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  allotment_status text not null
    check (allotment_status in ('ALLOTTED', 'NOT_ALLOTTED', 'PARTIAL_ALLOTMENT')),
  allotted_lots integer not null check (allotted_lots >= 0),
  allotted_shares bigint not null check (allotted_shares >= 0),
  allotment_price numeric(18, 6) check (allotment_price is null or allotment_price > 0),
  refund_amount numeric(38, 6) not null default 0 check (refund_amount >= 0),
  refund_status text not null default 'NOT_REQUIRED'
    check (refund_status in ('NOT_REQUIRED', 'PENDING', 'COMPLETED')),
  allotment_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint allotments_owner_application_fk
    foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete restrict,
  constraint allotments_application_unique unique (application_id),
  constraint allotments_id_user_unique unique (id, user_id)
);

create index allotments_owner_status_idx
  on public.allotments (user_id, allotment_status, allotment_date desc);

create trigger allotments_set_updated_at
  before update on public.allotments
  for each row execute function public.set_updated_at();

create table public.allotment_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  allotment_id uuid not null,
  changed_at timestamptz not null default now(),
  previous_values jsonb not null check (jsonb_typeof(previous_values) = 'object'),
  new_values jsonb not null check (jsonb_typeof(new_values) = 'object'),
  constraint allotment_history_owner_allotment_fk
    foreign key (allotment_id, user_id)
    references public.allotments (id, user_id) on delete restrict
);

create index allotment_history_owner_changed_idx
  on public.allotment_history (user_id, changed_at desc);

create table public.capital_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid,
  transaction_type text not null check (
    transaction_type in (
      'APPLICATION_RECORDED', 'MANDATE_APPROVED', 'CAPITAL_BLOCKED', 'CAPITAL_RELEASED',
      'ACTUAL_DEBIT', 'ALLOTMENT_DEBIT', 'REFUND_RECEIVED', 'LISTING_SALE',
      'LISTING_PRICE_UPDATE', 'ADJUSTMENT'
    )
  ),
  amount numeric(38, 6) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),
  source text not null check (source in ('MANUAL', 'SYSTEM', 'AUTHORIZED_INTEGRATION')),
  audit_reference text not null check (char_length(btrim(audit_reference)) between 1 and 200),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 200),
  quantity bigint check (quantity is null or quantity > 0),
  unit_price numeric(18, 6) check (unit_price is null or unit_price > 0),
  adjustment_direction text check (adjustment_direction in ('DEBIT', 'CREDIT')),
  blocked_consumed numeric(38, 6) not null default 0 check (blocked_consumed >= 0),
  constraint capital_ledger_owner_application_fk
    foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete restrict,
  constraint capital_ledger_idempotency_unique unique (user_id, idempotency_key),
  constraint capital_ledger_audit_event_unique
    unique (user_id, source, transaction_type, audit_reference),
  constraint capital_ledger_id_user_unique unique (id, user_id),
  constraint capital_ledger_price_quantity_check check (
    (
      transaction_type in ('LISTING_SALE', 'LISTING_PRICE_UPDATE')
      and quantity is not null
      and unit_price is not null
      and amount = quantity * unit_price
    )
    or (
      transaction_type not in ('LISTING_SALE', 'LISTING_PRICE_UPDATE')
      and quantity is null
      and unit_price is null
    )
  ),
  constraint capital_ledger_adjustment_direction_required_check check (
    (transaction_type = 'ADJUSTMENT' and adjustment_direction is not null)
    or (transaction_type <> 'ADJUSTMENT' and adjustment_direction is null)
  )
);

create index capital_ledger_owner_effective_idx
  on public.capital_ledger (user_id, effective_at desc, id);
create index capital_ledger_owner_application_idx
  on public.capital_ledger (user_id, application_id, effective_at, id);

create function public.validate_application_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ipo_record public.ipos%rowtype;
  rule_record public.ipo_categories%rowtype;
  calculation_record public.ipo_quota_calculations%rowtype;
  condition_record jsonb;
  calculated_amount numeric;
begin
  if new.quota_calculation_id is null then
    return new;
  end if;

  select * into ipo_record
  from public.ipos
  where id = new.ipo_id and user_id = new.user_id;
  if not found then
    raise exception using errcode = '23503', message = 'Application IPO is unavailable.';
  end if;

  select * into rule_record
  from public.ipo_categories
  where id = new.category_configuration_id
    and ipo_id = new.ipo_id
    and user_id = new.user_id
    and category = new.category
    and rule_version = new.rule_version;
  if not found then
    raise exception using errcode = '23503', message = 'Application category rules are unavailable.';
  end if;

  select * into calculation_record
  from public.ipo_quota_calculations
  where id = new.quota_calculation_id
    and user_id = new.user_id
    and ipo_id = new.ipo_id
    and category_configuration_id = new.category_configuration_id
    and demat_account_id = new.demat_account_id
    and category = new.category
    and rule_version = new.rule_version;
  if not found or calculation_record.result_snapshot->>'eligible' <> 'true' then
    raise exception using errcode = '23514', message = 'Only an eligible owned calculation can be recorded.';
  end if;

  if ipo_record.archived_at is not null then
    raise exception using errcode = '23514', message = 'An archived IPO cannot create a new application record.';
  end if;

  if (calculation_record.input_snapshot->'ipo'->>'lot_size')::integer
      is distinct from new.lot_size
    or (calculation_record.input_snapshot->'ipo'->>'issue_price_min')::numeric
      is distinct from new.issue_price_min
    or (calculation_record.input_snapshot->'ipo'->>'issue_price_max')::numeric
      is distinct from new.issue_price_max
    or (calculation_record.input_snapshot->'ipo'->>'cut_off_price')::numeric
      is distinct from new.cut_off_price
    or (calculation_record.input_snapshot->'category_configuration'->>'id')::uuid
      is distinct from new.category_configuration_id
    or (calculation_record.input_snapshot->'category_configuration'->>'rule_version')::integer
      is distinct from new.rule_version then
    raise exception using errcode = '23514', message = 'Application issue terms must match the saved calculation.';
  end if;

  if new.lots::bigint * new.lot_size <> new.shares
    or new.shares::numeric * new.price <> new.application_amount
    or new.price < new.issue_price_min
    or new.price > new.issue_price_max
    or (new.price_type = 'CUT_OFF'
      and (new.cut_off_price is null or new.price <> new.cut_off_price))
    or not (new.price_type = any(rule_record.allowed_price_types))
    or (rule_record.minimum_price_increment is not null
      and mod(new.price, rule_record.minimum_price_increment) <> 0) then
    raise exception using errcode = '23514', message = 'Application values do not match the IPO configuration.';
  end if;

  if rule_record.lot_limit_status <> 'UNCONFIGURED'
    and (
      (rule_record.minimum_lots is not null and new.lots < rule_record.minimum_lots)
      or (rule_record.maximum_lots is not null and new.lots > rule_record.maximum_lots)
      or mod(new.lots - coalesce(rule_record.minimum_lots, 1), rule_record.lot_increment) <> 0
    ) then
    raise exception using errcode = '23514', message = 'Application lots do not match the issue rules.';
  end if;
  if rule_record.lot_limit_status = 'UNCONFIGURED'
    or rule_record.investment_limit_status = 'UNCONFIGURED' then
    raise exception using errcode = '23514', message = 'Application issue limits are not configured.';
  end if;

  calculated_amount := new.shares::numeric * new.price;
  if (rule_record.minimum_investment is not null
      and calculated_amount < rule_record.minimum_investment)
    or (rule_record.maximum_investment is not null
      and calculated_amount > rule_record.maximum_investment) then
    raise exception using errcode = '23514', message = 'Application amount does not match the issue rules.';
  end if;

  for condition_record in
    select value from pg_catalog.jsonb_array_elements(rule_record.eligibility_conditions)
  loop
    if calculation_record.input_snapshot->'eligibility_answers'->>(condition_record->>'id')
      is distinct from 'true' then
      raise exception using errcode = '23514', message = 'Application eligibility conditions are not confirmed.';
    end if;
  end loop;
  if new.category = 'SHAREHOLDER' and (
    rule_record.shareholder_record_date is null
    or calculation_record.input_snapshot->>'shareholder_shares' is null
    or (calculation_record.input_snapshot->>'shareholder_shares')::bigint < 1
    or (
      rule_record.minimum_shareholding is not null
      and (calculation_record.input_snapshot->>'shareholder_shares')::bigint
        < rule_record.minimum_shareholding
    )
  ) then
    raise exception using errcode = '23514', message = 'Application shareholder inputs do not satisfy the issue rules.';
  end if;

  if calculation_record.input_snapshot->>'lots' is distinct from new.lots::text
    or (calculation_record.input_snapshot->>'price')::numeric is distinct from new.price
    or calculation_record.input_snapshot->>'price_type' is distinct from new.price_type
    or calculation_record.input_snapshot->>'category' is distinct from new.category
    or (calculation_record.result_snapshot->>'total_shares')::numeric is distinct from new.shares
    or (calculation_record.result_snapshot->>'application_amount')::numeric
      is distinct from new.application_amount then
    raise exception using errcode = '23514', message = 'Application must preserve its calculation snapshot.';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_application_record() from public, anon, authenticated;

create trigger applications_validate_record
  before insert on public.applications
  for each row execute function public.validate_application_record();

create function public.validate_mandate_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_amount numeric(38, 6);
begin
  select a.application_amount into application_amount
  from public.applications a
  where a.id = new.application_id and a.user_id = new.user_id;
  if found and new.mandate_amount > application_amount then
    raise exception using errcode = '23514', message = 'Mandate amount must not exceed the application value.';
  end if;

  if tg_op = 'INSERT' and new.mandate_status <> 'PENDING' then
    raise exception using errcode = '23514', message = 'A new mandate must start as pending.';
  end if;
  if tg_op = 'UPDATE' and new.mandate_status <> old.mandate_status
    and not (
      (old.mandate_status = 'PENDING'
        and new.mandate_status in ('APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED'))
      or (old.mandate_status = 'APPROVED'
        and new.mandate_status in ('REVOKED', 'EXPIRED', 'RELEASED'))
    ) then
    raise exception using errcode = '23514', message = 'Invalid mandate status transition.';
  end if;

  if tg_op = 'UPDATE' and old.released_at is null and new.mandate_status = 'RELEASED' then
    new.released_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_mandate_change() from public, anon, authenticated;

create trigger mandates_validate_change
  before insert or update on public.mandates
  for each row execute function public.validate_mandate_change();

create function public.validate_allotment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
  received_refunds numeric(38, 6);
  allocation_value numeric(38, 6);
  historical_financial_entries boolean;
begin
  select * into application_record
  from public.applications
  where id = new.application_id and user_id = new.user_id;
  if not found then
    raise exception using errcode = '23503', message = 'Allotment application is unavailable.';
  end if;
  if application_record.quota_calculation_id is null then
    raise exception using errcode = '23514', message = 'Allotments require a saved quota calculation.';
  end if;
  if tg_op = 'UPDATE' then
    select exists (
      select 1
      from public.capital_ledger
      where application_id = new.application_id
        and user_id = new.user_id
        and transaction_type in (
          'ACTUAL_DEBIT', 'ALLOTMENT_DEBIT', 'REFUND_RECEIVED',
          'LISTING_SALE', 'LISTING_PRICE_UPDATE'
        )
    ) into historical_financial_entries;
    if historical_financial_entries and (
      new.allotment_status is distinct from old.allotment_status
      or new.allotted_lots is distinct from old.allotted_lots
      or new.allotted_shares is distinct from old.allotted_shares
      or new.allotment_price is distinct from old.allotment_price
    ) then
      raise exception using errcode = '23514', message = 'Allocation terms cannot change after financial events are recorded.';
    end if;
  end if;

  if new.allotment_status = 'NOT_ALLOTTED' then
    if new.allotted_lots <> 0 or new.allotted_shares <> 0 or new.allotment_price is not null then
      raise exception using errcode = '23514', message = 'A not-allotted application cannot have shares or a price.';
    end if;
  else
    if new.allotted_lots < 1
      or new.allotted_lots > application_record.lots
    or new.allotted_shares <> new.allotted_lots::bigint * application_record.lot_size
      or new.allotted_shares > application_record.shares
      or new.allotment_price is null
    or new.allotment_price < application_record.issue_price_min
    or new.allotment_price > application_record.issue_price_max
      or new.allotment_price > application_record.price then
      raise exception using errcode = '23514', message = 'Allotment values exceed the original application or issue terms.';
    end if;
    if new.allotment_status = 'ALLOTTED'
      and new.allotted_shares <> application_record.shares then
      raise exception using errcode = '23514', message = 'A full allotment must match the application quantity.';
    end if;
    if new.allotment_status = 'PARTIAL_ALLOTMENT'
      and new.allotted_shares >= application_record.shares then
      raise exception using errcode = '23514', message = 'A partial allotment must be smaller than the application quantity.';
    end if;
  end if;

  allocation_value := new.allotted_shares::numeric * coalesce(new.allotment_price, 0);
  if new.refund_amount > greatest(application_record.application_amount - allocation_value, 0) then
    raise exception using errcode = '23514', message = 'Refund amount exceeds the unallotted application value.';
  end if;

  select coalesce(sum(amount), 0) into received_refunds
  from public.capital_ledger
  where application_id = new.application_id
    and user_id = new.user_id
    and transaction_type = 'REFUND_RECEIVED';
  if received_refunds > new.refund_amount then
    raise exception using errcode = '23514', message = 'Refund amount cannot be lower than refunds already received.';
  end if;
  new.refund_status := case
    when new.refund_amount = 0 then 'NOT_REQUIRED'
    when received_refunds = new.refund_amount then 'COMPLETED'
    else 'PENDING'
  end;
  return new;
end;
$$;

revoke execute on function public.validate_allotment_change() from public, anon, authenticated;

create trigger allotments_validate_change
  before insert or update on public.allotments
  for each row execute function public.validate_allotment_change();

create function public.record_allotment_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.allotment_history (
    user_id, allotment_id, previous_values, new_values
  )
  values (
    old.user_id,
    old.id,
    pg_catalog.to_jsonb(old) - 'updated_at',
    pg_catalog.to_jsonb(new) - 'updated_at'
  );
  return new;
end;
$$;

revoke execute on function public.record_allotment_history() from public, anon, authenticated;

create trigger allotments_record_history
  after update on public.allotments
  for each row execute function public.record_allotment_history();

create function public.validate_capital_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
  allotment_record public.allotments%rowtype;
  blocked_balance numeric(38, 6);
  existing_total numeric(38, 6);
  maximum_refund numeric(38, 6);
  sold_shares bigint;
  remaining_shares bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(coalesce(new.application_id::text, new.user_id::text), 0)
  );
  new.blocked_consumed := 0;

  if new.transaction_type <> 'ADJUSTMENT' and new.application_id is null then
    raise exception using errcode = '23514', message = 'This transaction type requires an application reference.';
  end if;
  if new.application_id is null then
    if new.transaction_type <> 'ADJUSTMENT' then
      raise exception using errcode = '23514', message = 'A ledger adjustment must be explicitly classified.';
    end if;
  else
    select * into application_record
    from public.applications
    where id = new.application_id and user_id = new.user_id;
    if not found then
      raise exception using errcode = '23503', message = 'Ledger application is unavailable.';
    end if;
    if new.currency <> application_record.currency then
      raise exception using errcode = '23514', message = 'Ledger currency must match the application currency.';
    end if;
  end if;

  if new.transaction_type in ('CAPITAL_BLOCKED', 'CAPITAL_RELEASED', 'ACTUAL_DEBIT') then
    select coalesce(
      sum(case
        when transaction_type = 'CAPITAL_BLOCKED' then amount
        when transaction_type = 'CAPITAL_RELEASED' then -amount
        else -blocked_consumed
      end),
      0
    )
    into blocked_balance
    from public.capital_ledger
    where application_id = new.application_id and user_id = new.user_id;
    if blocked_balance < 0 then
      raise exception using errcode = '23514', message = 'Existing blocked capital does not reconcile.';
    end if;
    if new.transaction_type = 'CAPITAL_BLOCKED' then
      if blocked_balance + new.amount > application_record.application_amount then
        raise exception using errcode = '23514', message = 'Blocked capital exceeds the application value.';
      end if;
    elsif new.transaction_type = 'CAPITAL_RELEASED' then
      if new.amount > blocked_balance then
        raise exception using errcode = '23514', message = 'Released capital exceeds currently blocked capital.';
      end if;
    else
      new.blocked_consumed := least(new.amount, blocked_balance);
    end if;
  end if;

  if new.transaction_type = 'ACTUAL_DEBIT' then
    select coalesce(sum(amount), 0) into existing_total
    from public.capital_ledger
    where application_id = new.application_id
      and user_id = new.user_id
      and transaction_type = 'ACTUAL_DEBIT';
    if existing_total + new.amount > application_record.application_amount then
      raise exception using errcode = '23514', message = 'Actual debits exceed the application value.';
    end if;
  elsif new.transaction_type = 'REFUND_RECEIVED' then
    select * into allotment_record
    from public.allotments
    where application_id = new.application_id and user_id = new.user_id;
    if not found then
      raise exception using errcode = '23514', message = 'A refund requires an allotment record.';
    end if;
    select coalesce(sum(amount), 0) into existing_total
    from public.capital_ledger
    where application_id = new.application_id
      and user_id = new.user_id
      and transaction_type = 'REFUND_RECEIVED';
    select coalesce(sum(amount), 0) into maximum_refund
    from public.capital_ledger
    where application_id = new.application_id
      and user_id = new.user_id
      and transaction_type = 'ACTUAL_DEBIT';
    maximum_refund := least(
      allotment_record.refund_amount,
      greatest(
        maximum_refund
          - allotment_record.allotted_shares::numeric * coalesce(allotment_record.allotment_price, 0),
        0
      )
    );
    if existing_total + new.amount > maximum_refund then
      raise exception using errcode = '23514', message = 'Refund receipts exceed the expected refund amount.';
    end if;
  elsif new.transaction_type = 'ALLOTMENT_DEBIT' then
    select * into allotment_record
    from public.allotments
    where application_id = new.application_id and user_id = new.user_id;
    if not found then
      raise exception using errcode = '23514', message = 'An allotment debit requires an allotment record.';
    end if;
    select coalesce(sum(amount), 0) into existing_total
    from public.capital_ledger
    where application_id = new.application_id
      and user_id = new.user_id
      and transaction_type = 'ALLOTMENT_DEBIT';
    if existing_total + new.amount >
      allotment_record.allotted_shares::numeric * coalesce(allotment_record.allotment_price, 0) then
      raise exception using errcode = '23514', message = 'Allotment debits exceed the recorded allocation value.';
    end if;
  elsif new.transaction_type in ('LISTING_SALE', 'LISTING_PRICE_UPDATE') then
    select * into allotment_record
    from public.allotments
    where application_id = new.application_id and user_id = new.user_id;
    if not found or allotment_record.allotted_shares = 0 then
      raise exception using errcode = '23514', message = 'Listing transactions require an allotment.';
    end if;
    select coalesce(sum(quantity), 0) into sold_shares
    from public.capital_ledger
    where application_id = new.application_id
      and user_id = new.user_id
      and transaction_type = 'LISTING_SALE';
    remaining_shares := allotment_record.allotted_shares - sold_shares;
    if new.transaction_type = 'LISTING_SALE' and new.quantity > remaining_shares then
      raise exception using errcode = '23514', message = 'Sale quantity exceeds the remaining allotted shares.';
    end if;
    if new.transaction_type = 'LISTING_PRICE_UPDATE' and new.quantity <> remaining_shares then
      raise exception using errcode = '23514', message = 'A listing valuation must cover remaining allotted shares.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_capital_ledger_entry() from public, anon, authenticated;

create trigger capital_ledger_validate_entry
  before insert on public.capital_ledger
  for each row execute function public.validate_capital_ledger_entry();

create function public.record_application_ledger_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.capital_ledger (
    user_id, application_id, transaction_type, amount, currency, effective_at,
    source, audit_reference, idempotency_key
  )
  values (
    new.user_id, new.id, 'APPLICATION_RECORDED', new.application_amount, new.currency,
    new.created_at, 'SYSTEM', new.id::text, 'application:' || new.id::text || ':recorded'
  );
  return new;
end;
$$;

revoke execute on function public.record_application_ledger_event() from public, anon, authenticated;

create trigger applications_record_ledger_event
  after insert on public.applications
  for each row execute function public.record_application_ledger_event();

create function public.record_mandate_approval_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_currency text;
begin
  if new.mandate_status = 'APPROVED'
    and (tg_op = 'INSERT' or old.mandate_status <> 'APPROVED') then
    select currency into app_currency
    from public.applications
    where id = new.application_id and user_id = new.user_id;
    insert into public.capital_ledger (
      user_id, application_id, transaction_type, amount, currency, effective_at,
      source, audit_reference, idempotency_key
    )
    values (
      new.user_id, new.application_id, 'MANDATE_APPROVED', new.mandate_amount, app_currency,
      now(), 'SYSTEM', new.id::text, 'mandate:' || new.id::text || ':approved'
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.record_mandate_approval_event() from public, anon, authenticated;

create trigger mandates_record_approval_event
  after insert or update on public.mandates
  for each row execute function public.record_mandate_approval_event();

create function public.record_mandate_blocked_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.transaction_type = 'CAPITAL_BLOCKED' then
    update public.mandates
    set blocked_at = coalesce(blocked_at, new.effective_at)
    where application_id = new.application_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.record_mandate_blocked_at() from public, anon, authenticated;

create trigger capital_ledger_record_mandate_block
  after insert on public.capital_ledger
  for each row execute function public.record_mandate_blocked_at();

create function public.refresh_allotment_refund_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_total numeric(24, 4);
begin
  if new.transaction_type = 'REFUND_RECEIVED' then
    select coalesce(sum(amount), 0) into refund_total
    from public.capital_ledger
    where application_id = new.application_id
      and user_id = new.user_id
      and transaction_type = 'REFUND_RECEIVED';
    update public.allotments
    set refund_status = case
      when refund_total = refund_amount then 'COMPLETED'
      else 'PENDING'
    end
    where application_id = new.application_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.refresh_allotment_refund_status() from public, anon, authenticated;

create trigger capital_ledger_refresh_refund_status
  after insert on public.capital_ledger
  for each row execute function public.refresh_allotment_refund_status();

create function public.prevent_capital_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'Capital ledger entries are immutable.';
end;
$$;

revoke execute on function public.prevent_capital_ledger_mutation() from public, anon, authenticated;

create trigger capital_ledger_immutable
  before update or delete on public.capital_ledger
  for each row execute function public.prevent_capital_ledger_mutation();

alter table public.applications enable row level security;
alter table public.applications force row level security;
alter table public.mandates enable row level security;
alter table public.mandates force row level security;
alter table public.allotments enable row level security;
alter table public.allotments force row level security;
alter table public.allotment_history enable row level security;
alter table public.allotment_history force row level security;
alter table public.capital_ledger enable row level security;
alter table public.capital_ledger force row level security;

create policy "Users read their own applications"
  on public.applications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create applications from their own calculations"
  on public.applications for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users read their own mandates"
  on public.mandates for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own mandates"
  on public.mandates for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their own mandates"
  on public.mandates for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read their own allotments"
  on public.allotments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own allotments"
  on public.allotments for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their own allotments"
  on public.allotments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users read their own allotment history"
  on public.allotment_history for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read their own capital ledger"
  on public.capital_ledger for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users add manual capital ledger entries"
  on public.capital_ledger for insert to authenticated
  with check ((select auth.uid()) = user_id and source = 'MANUAL');

revoke all on public.applications, public.mandates, public.allotments,
  public.allotment_history, public.capital_ledger from public, anon, authenticated;
grant select, insert (user_id, ipo_id, demat_account_id, category_configuration_id,
  quota_calculation_id, category, rule_version, lot_size, issue_price_min, issue_price_max,
  cut_off_price, category_id, lots, shares, total_shares, price_type, price,
  application_amount, application_number, external_reference, submission_date,
  application_status, mandate_status, allotment_status, notes, calculation_snapshot,
  currency)
  on public.applications to authenticated;
grant select on public.applications to authenticated;
grant update (
  application_number, external_reference, submission_date, application_status, mandate_status,
  allotment_status, notes, archived_at
) on public.applications to authenticated;
grant select on public.mandates to authenticated;
grant insert (user_id, application_id, mandate_reference, mandate_amount, mandate_status, notes)
  on public.mandates to authenticated;
grant update (mandate_reference, mandate_amount, mandate_status, notes)
  on public.mandates to authenticated;
grant select on public.allotments to authenticated;
grant insert (user_id, application_id, allotment_status, allotted_lots, allotted_shares,
  allotment_price, refund_amount, allotment_date)
  on public.allotments to authenticated;
grant update (allotment_status, allotted_lots, allotted_shares, allotment_price,
  refund_amount, allotment_date)
  on public.allotments to authenticated;
grant select on public.allotment_history to authenticated;
grant select on public.capital_ledger to authenticated;
grant insert (user_id, application_id, transaction_type, amount, currency, effective_at,
  source, audit_reference, idempotency_key, quantity, unit_price, adjustment_direction)
  on public.capital_ledger to authenticated;

comment on table public.applications is
  'Immutable, owner-scoped manual application records created only from eligible quota snapshots; no submission is initiated.';
comment on table public.mandates is
  'User-managed UPI mandate records. Approval is manual and does not record a completed debit.';
comment on table public.allotments is
  'User-maintained allotment and refund state validated against its original application and issue rules.';
comment on table public.allotment_history is
  'Append-only before/after snapshots of user-managed allotment updates.';
comment on table public.capital_ledger is
  'Immutable decimal-safe financial event ledger with per-user idempotency and audit references.';
