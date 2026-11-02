create function public.get_dashboard_catalog_analytics(
  p_catalog_ipo_id uuid default null,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception using errcode = '22023', message = 'limit must be between 1 and 50';
  end if;

  return pg_catalog.jsonb_build_object(
    'total', (
      select count(*)::integer
      from public.ipo_catalog i
      where i.archived_at is null
        and (p_catalog_ipo_id is null or i.id = p_catalog_ipo_id)
    ),
    'by_status', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('status', statuses.status, 'count', statuses.ipo_count)
        order by statuses.sort_order
      ), '[]'::jsonb)
      from (
        select status.status, status.sort_order, count(i.id)::integer as ipo_count
        from (values
          ('upcoming', 1), ('open', 2), ('closed', 3), ('listed', 4)
        ) as status(status, sort_order)
        left join public.ipo_catalog i
          on i.ipo_status = status.status
          and i.archived_at is null
          and (p_catalog_ipo_id is null or i.id = p_catalog_ipo_id)
        group by status.status, status.sort_order
      ) statuses
    ),
    'issues', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'ipo_id', issue.id,
        'company_name', issue.company_name,
        'symbol', issue.symbol,
        'status', pg_catalog.upper(issue.ipo_status),
        'issue_type', issue.issue_type,
        'exchange', issue.exchange,
        'price_band_min', issue.price_band_min::text,
        'price_band_max', issue.price_band_max::text,
        'lot_size', issue.lot_size,
        'opening_date', issue.bidding_start_date,
        'closing_date', issue.bidding_end_date,
        'data_source', issue.data_source
      ) order by issue.priority, issue.bidding_end_date nulls last, issue.updated_at desc, issue.id), '[]'::jsonb)
      from (
        select i.*,
          case i.ipo_status when 'open' then 0 when 'upcoming' then 1 else 2 end as priority
        from public.ipo_catalog i
        where i.archived_at is null
          and (p_catalog_ipo_id is null or i.id = p_catalog_ipo_id)
        order by priority, i.bidding_end_date nulls last, i.updated_at desc, i.id
        limit p_limit
      ) issue
    ),
    'upcoming', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'ipo_id', issue.id,
        'company_name', issue.company_name,
        'symbol', issue.symbol,
        'status', pg_catalog.upper(issue.ipo_status),
        'closing_date', issue.bidding_end_date,
        'data_source', issue.data_source
      ) order by issue.bidding_end_date, issue.company_name, issue.id), '[]'::jsonb)
      from (
        select i.id, i.company_name, i.symbol, i.ipo_status, i.bidding_end_date, i.data_source
        from public.ipo_catalog i
        where i.archived_at is null
          and i.ipo_status in ('upcoming', 'open')
          and i.bidding_end_date >= current_date
          and (p_catalog_ipo_id is null or i.id = p_catalog_ipo_id)
        order by i.bidding_end_date, i.company_name, i.id
        limit p_limit
      ) issue
    )
  );
end;
$$;

revoke all on function public.get_dashboard_catalog_analytics(uuid, integer) from public, anon;
grant execute on function public.get_dashboard_catalog_analytics(uuid, integer) to authenticated;
