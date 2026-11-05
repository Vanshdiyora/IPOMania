create function public.get_application_summary(p_ipo_id uuid default null)
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

  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'distinct_ipo_count', count(distinct a.ipo_id)::integer,
      'category_counts', jsonb_build_object(
        'RETAIL', count(*) filter (where coalesce(c.category, a.category_code) = 'RETAIL')::integer,
        'SHNI', count(*) filter (where coalesce(c.category, a.category_code) = 'SHNI')::integer,
        'BHNI', count(*) filter (where coalesce(c.category, a.category_code) = 'BHNI')::integer,
        'SHAREHOLDER', count(*) filter (where coalesce(c.category, a.category_code) = 'SHAREHOLDER')::integer,
        'EMPLOYER', count(*) filter (where coalesce(c.category, a.category_code) = 'EMPLOYER')::integer
      )
    )
    from public.applications a
    left join public.ipo_categories c
      on c.id = a.category_id
      and c.user_id = a.user_id
    where a.user_id = auth.uid()
      and a.archived_at is null
      and (p_ipo_id is null or a.ipo_id = p_ipo_id)
  );
end;
$$;

revoke all on function public.get_application_summary(uuid) from public, anon;
grant execute on function public.get_application_summary(uuid) to authenticated;

create function public.get_ipo_catalog_status_counts(
  p_search text default null,
  p_statuses text[] default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  search_pattern text;
  symbol_pattern text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if p_search is not null and length(p_search) > 160 then
    raise exception using errcode = '22023', message = 'search must be at most 160 characters';
  end if;
  if p_statuses is not null and not (
    p_statuses <@ array['upcoming', 'open', 'closed', 'listed']::text[]
  ) then
    raise exception using errcode = '22023', message = 'IPO status is invalid';
  end if;

  if p_search is not null then
    search_pattern := '%' || replace(replace(replace(p_search, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
    symbol_pattern := replace(replace(replace(p_search, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  end if;

  return (
    select jsonb_build_object(
      'upcoming', count(*) filter (where i.ipo_status = 'upcoming')::integer,
      'open', count(*) filter (where i.ipo_status = 'open')::integer,
      'closed', count(*) filter (where i.ipo_status = 'closed')::integer,
      'listed', count(*) filter (where i.ipo_status = 'listed')::integer
    )
    from public.ipo_catalog i
    where i.archived_at is null
      and (p_statuses is null or i.ipo_status = any(p_statuses))
      and (
        p_search is null
        or i.company_name ilike search_pattern escape E'\\'
        or i.symbol ilike symbol_pattern escape E'\\'
      )
  );
end;
$$;

revoke all on function public.get_ipo_catalog_status_counts(text, text[]) from public, anon;
grant execute on function public.get_ipo_catalog_status_counts(text, text[]) to authenticated;
