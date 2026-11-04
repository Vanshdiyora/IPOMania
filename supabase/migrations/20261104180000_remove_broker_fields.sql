-- Broker information is no longer collected or exposed for demat accounts.
-- Replace dependent functions before removing the account columns.
drop function if exists public.confirm_account_import(uuid);
drop function if exists public.get_dashboard_analytics(date, date, uuid, text, uuid, integer);

alter table public.demat_accounts
  drop column if exists broker_code,
  drop column if exists broker_name;

create function public.confirm_account_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.account_imports%rowtype;
  import_row record;
  new_account_id uuid;
  inserted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into import_record from public.account_imports where id = p_import_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'IMPORT_NOT_FOUND';
  end if;
  if import_record.user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'IMPORT_NOT_OWNED';
  end if;
  if import_record.status = 'confirmed' then
    return jsonb_build_object('import_id', import_record.id, 'imported_rows', import_record.imported_rows, 'status', import_record.status);
  end if;
  if import_record.status <> 'preview' then
    raise exception using errcode = '23514', message = 'IMPORT_NOT_CONFIRMABLE';
  end if;

  for import_row in
    select * from public.account_import_rows
    where import_id = p_import_id and row_status = 'ready'
    order by row_number for update
  loop
    insert into public.demat_accounts (
      user_id, holder_name, depository_type, masked_demat_identifier,
      masked_client_reference, account_status, notes
    ) values (
      import_record.user_id, import_row.record->>'holder_name',
      import_row.record->>'depository_type', import_row.record->>'masked_demat_identifier',
      nullif(import_row.record->>'masked_client_reference', ''),
      coalesce(nullif(import_row.record->>'account_status', ''), 'active'),
      nullif(import_row.record->>'notes', '')
    ) returning id into new_account_id;

    update public.account_import_rows
    set created_account_id = new_account_id, row_status = 'imported'
    where import_id = p_import_id and row_number = import_row.row_number;
    inserted_count := inserted_count + 1;
  end loop;

  update public.account_imports
  set status = 'confirmed', imported_rows = inserted_count, confirmed_at = now()
  where id = p_import_id;
  return jsonb_build_object('import_id', p_import_id, 'imported_rows', inserted_count, 'status', 'confirmed');
end;
$$;

revoke execute on function public.confirm_account_import(uuid) from public, anon;
grant execute on function public.confirm_account_import(uuid) to authenticated;

create function public.get_dashboard_analytics(
  p_date_from date default null,
  p_date_to date default null,
  p_ipo_id uuid default null,
  p_category text default null,
  p_account_id uuid default null,
  p_limit integer default 10
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered_applications as materialized (
    select a.*, i.company_name, i.symbol, d.holder_name, d.masked_demat_identifier,
      coalesce(c.category, a.category_code) as category
    from public.applications a
    join public.ipos i on i.id = a.ipo_id and i.user_id = a.user_id
    join public.demat_accounts d on d.id = a.demat_account_id and d.user_id = a.user_id
    left join public.ipo_categories c on c.id = a.category_id and c.user_id = a.user_id
    where a.user_id = auth.uid()
      and a.archived_at is null
      and (p_date_from is null or a.created_at >= p_date_from::timestamp at time zone 'UTC')
      and (p_date_to is null or a.created_at < (p_date_to + 1)::timestamp at time zone 'UTC')
      and (p_ipo_id is null or a.ipo_id = p_ipo_id)
      and (p_category is null or coalesce(c.category, a.category_code) = p_category)
      and (p_account_id is null or a.demat_account_id = p_account_id)
  ),
  filtered_ledger as materialized (
    select l.* from public.capital_ledger l
    left join public.applications a on a.id = l.application_id and a.user_id = l.user_id
    where l.user_id = auth.uid()
      and (p_date_from is null or l.effective_at >= p_date_from::timestamp at time zone 'UTC')
      and (p_date_to is null or l.effective_at < (p_date_to + 1)::timestamp at time zone 'UTC')
      and (p_ipo_id is null or a.ipo_id = p_ipo_id)
      and (p_account_id is null or a.demat_account_id = p_account_id)
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'applications', (select count(*) from filtered_applications),
      'active_demat_accounts', (select count(*) from public.demat_accounts where user_id = auth.uid() and account_status = 'active' and archived_at is null),
      'tracked_ipos', (select count(*) from public.ipos where user_id = auth.uid() and archived_at is null)
    ),
    'applications_by_status', coalesce((select jsonb_agg(jsonb_build_object('status', application_status, 'count', count) order by application_status) from (select application_status, count(*)::integer as count from filtered_applications group by application_status) s), '[]'::jsonb),
    'applications_by_ipo', coalesce((select jsonb_agg(jsonb_build_object('ipo_id', ipo_id, 'company_name', company_name, 'symbol', symbol, 'count', count) order by count desc, company_name) from (select ipo_id, company_name, symbol, count(*)::integer as count from filtered_applications group by ipo_id, company_name, symbol limit p_limit) i), '[]'::jsonb),
    'applications_by_category', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'count', count) order by count desc, category) from (select category, count(*)::integer as count from filtered_applications group by category limit p_limit) c), '[]'::jsonb),
    'applications_by_account', coalesce((select jsonb_agg(jsonb_build_object('account_id', demat_account_id, 'holder_name', holder_name, 'masked_demat_identifier', masked_demat_identifier, 'count', count) order by count desc, holder_name) from (select demat_account_id, holder_name, masked_demat_identifier, count(*)::integer as count from filtered_applications group by demat_account_id, holder_name, masked_demat_identifier limit p_limit) d), '[]'::jsonb),
    'monthly_application_trends', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'count', count) order by month) from (select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::integer as count from filtered_applications group by 1) m), '[]'::jsonb),
    'capital_utilization_trends', '[]'::jsonb,
    'capital_event_totals', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'capital_blocked', capital_blocked, 'actual_debit', actual_debit, 'refund_received', refund_received, 'capital_block_events', capital_block_events, 'actual_debit_events', actual_debit_events, 'refund_receipt_events', refund_receipt_events, 'listing_sales', listing_sales, 'listing_price_updates', listing_price_updates)) from (select currency, coalesce(sum(amount) filter (where transaction_type = 'CAPITAL_BLOCKED'), 0)::text as capital_blocked, coalesce(sum(amount) filter (where transaction_type in ('ACTUAL_DEBIT', 'ALLOTMENT_DEBIT')), 0)::text as actual_debit, coalesce(sum(amount) filter (where transaction_type = 'REFUND_RECEIVED'), 0)::text as refund_received, count(*) filter (where transaction_type = 'CAPITAL_BLOCKED')::integer as capital_block_events, count(*) filter (where transaction_type in ('ACTUAL_DEBIT', 'ALLOTMENT_DEBIT'))::integer as actual_debit_events, count(*) filter (where transaction_type = 'REFUND_RECEIVED')::integer as refund_receipt_events, count(*) filter (where transaction_type = 'LISTING_SALE')::integer as listing_sales, count(*) filter (where transaction_type = 'LISTING_PRICE_UPDATE')::integer as listing_price_updates from filtered_ledger group by currency) l), '[]'::jsonb),
    'allotment_performance', coalesce((select jsonb_build_object('total', count(*)::integer, 'successful', count(*) filter (where allotted_shares > 0)::integer, 'success_rate_percent', case when count(*) = 0 then null else (count(*) filter (where allotted_shares > 0) * 100.0 / count(*))::numeric(7, 4)::text end, 'full', count(*) filter (where allotment_status = 'ALLOTTED')::integer, 'partial', count(*) filter (where allotment_status = 'PARTIAL_ALLOTMENT')::integer, 'none', count(*) filter (where allotment_status = 'NOT_ALLOTTED')::integer) from public.allotments where user_id = auth.uid() and application_id in (select id from filtered_applications)), jsonb_build_object('total', 0, 'successful', 0, 'success_rate_percent', null, 'full', 0, 'partial', 0, 'none', 0)),
    'refund_performance', coalesce((select jsonb_build_object('total', count(*)::integer, 'pending', count(*) filter (where refund_status = 'PENDING')::integer, 'completed', count(*) filter (where refund_status = 'COMPLETED')::integer, 'pending_expected_amount', coalesce(sum(refund_amount) filter (where refund_status = 'PENDING'), 0)::text, 'completed_expected_amount', coalesce(sum(refund_amount) filter (where refund_status = 'COMPLETED'), 0)::text) from public.allotments where user_id = auth.uid() and application_id in (select id from filtered_applications)), jsonb_build_object('total', 0, 'pending', 0, 'completed', 0, 'pending_expected_amount', '0', 'completed_expected_amount', '0')),
    'recent_applications', coalesce((select jsonb_agg(jsonb_build_object('application_id', id, 'ipo_id', ipo_id, 'company_name', company_name, 'symbol', symbol, 'account_id', demat_account_id, 'holder_name', holder_name, 'masked_demat_identifier', masked_demat_identifier, 'category', category, 'status', application_status, 'created_at', created_at) order by created_at desc) from (select * from filtered_applications order by created_at desc limit p_limit) r), '[]'::jsonb),
    'upcoming_ipos', coalesce((select jsonb_agg(jsonb_build_object('ipo_id', id, 'company_name', company_name, 'symbol', symbol, 'status', status, 'closing_date', closing_date, 'data_source', data_source) order by closing_date, company_name) from (select id, company_name, symbol, status, closing_date, data_source from public.ipos where user_id = auth.uid() and archived_at is null and status in ('UPCOMING', 'OPEN') and closing_date >= current_date and (p_ipo_id is null or id = p_ipo_id) order by closing_date, company_name limit p_limit) upcoming), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_dashboard_analytics(date, date, uuid, text, uuid, integer) from public, anon;
grant execute on function public.get_dashboard_analytics(date, date, uuid, text, uuid, integer) to authenticated;
