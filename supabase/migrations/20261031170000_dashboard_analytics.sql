create function public.get_dashboard_analytics(
  p_date_from date default null,
  p_date_to date default null,
  p_ipo_id uuid default null,
  p_category text default null,
  p_account_id uuid default null,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_date_from is not null and p_date_to is not null and p_date_from > p_date_to then
    raise exception using errcode = '22023', message = 'date_from must not be after date_to';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_to - p_date_from > 3650 then
    raise exception using errcode = '22023', message = 'date range cannot exceed 10 years';
  end if;
  if p_category is not null and p_category not in ('RETAIL', 'SHNI', 'BHNI', 'SHAREHOLDER') then
    raise exception using errcode = '22023', message = 'category is invalid';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception using errcode = '22023', message = 'limit must be between 1 and 50';
  end if;
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  with filtered_applications as materialized (
    select
      a.id,
      a.ipo_id,
      a.demat_account_id,
      a.category_id,
      a.application_status,
      a.application_amount,
      a.created_at,
      c.category,
      i.company_name,
      i.symbol,
      d.holder_name,
      d.masked_demat_identifier,
      d.broker_name
    from public.applications a
    join public.ipos i
      on i.id = a.ipo_id and i.user_id = a.user_id
    join public.demat_accounts d
      on d.id = a.demat_account_id and d.user_id = a.user_id
    join public.ipo_categories c
      on c.id = a.category_id and c.user_id = a.user_id
    where a.user_id = (select auth.uid())
      and a.archived_at is null
      and (p_date_from is null or a.created_at >= (p_date_from::timestamp at time zone 'UTC'))
      and (p_date_to is null or a.created_at < ((p_date_to + 1)::timestamp at time zone 'UTC'))
      and (p_ipo_id is null or a.ipo_id = p_ipo_id)
      and (p_category is null or c.category = p_category)
      and (p_account_id is null or a.demat_account_id = p_account_id)
  ),
  filtered_ledger as materialized (
    select
      l.transaction_type,
      l.amount,
      l.currency,
      l.application_id,
      l.effective_at
    from public.capital_ledger l
    left join public.applications a
      on a.id = l.application_id and a.user_id = l.user_id
    left join public.ipo_categories c
      on c.id = a.category_id and c.user_id = a.user_id
    where l.user_id = (select auth.uid())
      and a.archived_at is null
      and (p_date_from is null or l.effective_at >= (p_date_from::timestamp at time zone 'UTC'))
      and (p_date_to is null or l.effective_at < ((p_date_to + 1)::timestamp at time zone 'UTC'))
      and (p_ipo_id is null or a.ipo_id = p_ipo_id)
      and (p_category is null or c.category = p_category)
      and (p_account_id is null or a.demat_account_id = p_account_id)
  ),
  trend_months as (
    select month_start::date as month_start
    from pg_catalog.generate_series(
      pg_catalog.date_trunc(
        'month',
        coalesce(
          p_date_from::timestamp,
          (p_date_to - interval '11 months')::timestamp,
          (current_date - interval '11 months')::timestamp
        )
      ),
      pg_catalog.date_trunc('month', coalesce(p_date_to, current_date)::timestamp),
      interval '1 month'
    ) as months(month_start)
  )
  select pg_catalog.jsonb_build_object(
    'totals', pg_catalog.jsonb_build_object(
      'applications', (select count(*) from filtered_applications),
      'active_demat_accounts', (
        select count(*)
        from public.demat_accounts d
        where d.user_id = (select auth.uid())
          and d.account_status = 'active'
          and d.archived_at is null
      ),
      'tracked_ipos', (
        select count(*)
        from public.ipos i
        where i.user_id = (select auth.uid())
          and i.archived_at is null
      )
    ),
    'applications_by_status', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('status', statuses.status, 'count', statuses.application_count)
          order by statuses.status
        ),
        '[]'::jsonb
      )
      from (
        select s.status, count(f.id)::integer as application_count
        from (values
          ('DRAFT'), ('SUBMITTED'), ('UNDER_PROCESSING'), ('REJECTED'), ('FAILED'), ('COMPLETED')
        ) as s(status)
        left join filtered_applications f on f.application_status = s.status
        group by s.status
      ) statuses
    ),
    'applications_by_ipo', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'ipo_id', grouped.ipo_id,
            'company_name', grouped.company_name,
            'symbol', grouped.symbol,
            'count', grouped.application_count
          )
          order by grouped.application_count desc, grouped.company_name
        ),
        '[]'::jsonb
      )
      from (
        select
          f.ipo_id,
          f.company_name,
          f.symbol,
          count(*)::integer as application_count
        from filtered_applications f
        group by f.ipo_id, f.company_name, f.symbol
        order by count(*) desc, f.company_name
        limit p_limit
      ) grouped
    ),
    'applications_by_category', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'category', grouped.category,
            'count', grouped.application_count
          )
          order by grouped.category
        ),
        '[]'::jsonb
      )
      from (
        select categories.category,
          count(f.id)::integer as application_count
        from (values ('RETAIL'), ('SHNI'), ('BHNI'), ('SHAREHOLDER')) as categories(category)
        left join filtered_applications f on f.category = categories.category
        group by categories.category
      ) grouped
    ),
    'applications_by_account', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'account_id', grouped.account_id,
            'holder_name', grouped.holder_name,
            'masked_demat_identifier', grouped.masked_demat_identifier,
            'broker_name', grouped.broker_name,
            'count', grouped.application_count
          )
          order by grouped.application_count desc, grouped.holder_name
        ),
        '[]'::jsonb
      )
      from (
        select
          f.demat_account_id as account_id,
          f.holder_name,
          f.masked_demat_identifier,
          f.broker_name,
          count(*)::integer as application_count
        from filtered_applications f
        group by f.demat_account_id, f.holder_name, f.masked_demat_identifier, f.broker_name
        order by count(*) desc, f.holder_name
        limit p_limit
      ) grouped
    ),
    'applications_by_broker', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'broker_name', grouped.broker_name,
            'count', grouped.application_count
          )
          order by grouped.application_count desc, grouped.broker_name
        ),
        '[]'::jsonb
      )
      from (
        select
          f.broker_name,
          count(*)::integer as application_count
        from filtered_applications f
        group by f.broker_name
        order by count(*) desc, f.broker_name
        limit p_limit
      ) grouped
    ),
    'monthly_application_trends', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'month', pg_catalog.to_char(m.month_start, 'YYYY-MM'),
            'count', coalesce(t.application_count, 0)
          )
          order by m.month_start
        ),
        '[]'::jsonb
      )
      from trend_months m
      left join lateral (
        select count(*)::integer as application_count
        from filtered_applications f
        where f.created_at >= (m.month_start::timestamp at time zone 'UTC')
          and f.created_at < ((m.month_start + interval '1 month')::timestamp at time zone 'UTC')
      ) t on true
    ),
    'capital_utilization_trends', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'month', grouped.month,
            'currency', grouped.currency,
            'capital_blocked', grouped.capital_blocked,
            'capital_released', grouped.capital_released,
            'actual_debit', grouped.actual_debit,
            'refund_received', grouped.refund_received,
            'capital_block_events', grouped.capital_block_events,
            'actual_debit_events', grouped.actual_debit_events,
            'refund_receipt_events', grouped.refund_receipt_events,
            'listing_sales', grouped.listing_sales,
            'listing_price_updates', grouped.listing_price_updates
          )
          order by grouped.month, grouped.currency
        ),
        '[]'::jsonb
      )
      from (
        select
          pg_catalog.to_char(pg_catalog.date_trunc('month', l.effective_at at time zone 'UTC'), 'YYYY-MM') as month,
          l.currency,
          coalesce(sum(l.amount) filter (where l.transaction_type = 'CAPITAL_BLOCKED'), 0)::text as capital_blocked,
          coalesce(sum(l.amount) filter (where l.transaction_type = 'CAPITAL_RELEASED'), 0)::text as capital_released,
          coalesce(sum(l.amount) filter (where l.transaction_type = 'ACTUAL_DEBIT'), 0)::text as actual_debit,
          coalesce(sum(l.amount) filter (where l.transaction_type = 'REFUND_RECEIVED'), 0)::text as refund_received,
          count(*) filter (where l.transaction_type = 'CAPITAL_BLOCKED')::integer as capital_block_events,
          count(*) filter (where l.transaction_type = 'ACTUAL_DEBIT')::integer as actual_debit_events,
          count(*) filter (where l.transaction_type = 'REFUND_RECEIVED')::integer as refund_receipt_events,
          count(*) filter (where l.transaction_type = 'LISTING_SALE')::integer as listing_sales,
          count(*) filter (where l.transaction_type = 'LISTING_PRICE_UPDATE')::integer as listing_price_updates
        from filtered_ledger l
        group by
          pg_catalog.date_trunc('month', l.effective_at at time zone 'UTC'),
          l.currency
      ) grouped
    ),
    'capital_event_totals', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'currency', grouped.currency,
            'capital_blocked', grouped.capital_blocked,
            'actual_debit', grouped.actual_debit,
            'refund_received', grouped.refund_received,
            'capital_block_events', grouped.capital_block_events,
            'actual_debit_events', grouped.actual_debit_events,
            'refund_receipt_events', grouped.refund_receipt_events,
            'listing_sales', grouped.listing_sales,
            'listing_price_updates', grouped.listing_price_updates
          )
          order by grouped.currency
        ),
        '[]'::jsonb
      )
      from (
        select
          l.currency,
          coalesce(sum(l.amount) filter (where l.transaction_type = 'CAPITAL_BLOCKED'), 0)::text as capital_blocked,
          coalesce(sum(l.amount) filter (where l.transaction_type = 'ACTUAL_DEBIT'), 0)::text as actual_debit,
          coalesce(sum(l.amount) filter (where l.transaction_type = 'REFUND_RECEIVED'), 0)::text as refund_received,
          count(*) filter (where l.transaction_type = 'CAPITAL_BLOCKED')::integer as capital_block_events,
          count(*) filter (where l.transaction_type = 'ACTUAL_DEBIT')::integer as actual_debit_events,
          count(*) filter (where l.transaction_type = 'REFUND_RECEIVED')::integer as refund_receipt_events,
          count(*) filter (where l.transaction_type = 'LISTING_SALE')::integer as listing_sales,
          count(*) filter (where l.transaction_type = 'LISTING_PRICE_UPDATE')::integer as listing_price_updates
        from filtered_ledger l
        group by l.currency
      ) grouped
    ),
    'allotment_performance', (
      select pg_catalog.jsonb_build_object(
        'total', count(*)::integer,
        'successful', count(*) filter (where a.allotted_shares > 0)::integer,
        'success_rate_percent', case
          when count(*) = 0 then null
          else (count(*) filter (where a.allotted_shares > 0) * 100.0 / count(*))::numeric(7, 4)::text
        end,
        'full', count(*) filter (where a.allotment_status = 'ALLOTTED')::integer,
        'partial', count(*) filter (where a.allotment_status = 'PARTIAL_ALLOTMENT')::integer,
        'none', count(*) filter (where a.allotment_status = 'NOT_ALLOTTED')::integer
      )
      from public.allotments a
      join filtered_applications f on f.id = a.application_id
      where a.user_id = (select auth.uid())
    ),
    'refund_performance', (
      select pg_catalog.jsonb_build_object(
        'total', count(*)::integer,
        'pending', count(*) filter (where a.refund_status = 'PENDING')::integer,
        'completed', count(*) filter (where a.refund_status = 'COMPLETED')::integer,
        'pending_expected_amount', coalesce(
          sum(a.refund_amount) filter (where a.refund_status = 'PENDING'), 0
        )::text,
        'completed_expected_amount', coalesce(
          sum(a.refund_amount) filter (where a.refund_status = 'COMPLETED'), 0
        )::text
      )
      from public.allotments a
      join filtered_applications f on f.id = a.application_id
      where a.user_id = (select auth.uid())
    ),
    'recent_applications', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'application_id', recent.id,
            'ipo_id', recent.ipo_id,
            'company_name', recent.company_name,
            'symbol', recent.symbol,
            'account_id', recent.demat_account_id,
            'holder_name', recent.holder_name,
            'masked_demat_identifier', recent.masked_demat_identifier,
            'category', recent.category,
            'status', recent.application_status,
            'created_at', recent.created_at
          )
          order by recent.created_at desc, recent.id
        ),
        '[]'::jsonb
      )
      from (
        select f.*
        from filtered_applications f
        order by f.created_at desc, f.id
        limit p_limit
      ) recent
    ),
    'upcoming_ipos', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'ipo_id', upcoming.id,
            'company_name', upcoming.company_name,
            'symbol', upcoming.symbol,
            'status', upcoming.status,
            'closing_date', upcoming.closing_date,
            'data_source', upcoming.data_source
          )
          order by upcoming.closing_date, upcoming.company_name
        ),
        '[]'::jsonb
      )
      from (
        select i.id, i.company_name, i.symbol, i.status, i.closing_date, i.data_source
        from public.ipos i
        where i.user_id = (select auth.uid())
          and i.archived_at is null
          and i.status in ('UPCOMING', 'OPEN')
          and i.closing_date >= current_date
          and (p_ipo_id is null or i.id = p_ipo_id)
        order by i.closing_date, i.company_name
        limit p_limit
      ) upcoming
    )
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_dashboard_analytics(date, date, uuid, text, uuid, integer)
  from public, anon;
grant execute on function public.get_dashboard_analytics(date, date, uuid, text, uuid, integer)
  to authenticated;
