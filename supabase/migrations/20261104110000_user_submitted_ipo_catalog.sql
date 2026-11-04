-- User-submitted IPO details are shared catalog records, not private issue masters.
-- Application calculations continue to use the existing owner-scoped snapshot created on import.
alter table public.ipo_catalog
  add column submitted_by uuid references auth.users(id) on delete set null,
  add column source_reference text check (
    source_reference is null or char_length(source_reference) <= 1000
  );

create index ipo_catalog_submitted_by_idx
  on public.ipo_catalog (submitted_by, created_at desc)
  where submitted_by is not null;

create unique index ipo_catalog_active_symbol_exchange_unique
  on public.ipo_catalog (upper(symbol), coalesce(exchange, ''))
  where symbol is not null and archived_at is null;

create policy "Users submit shared IPO catalog entries"
  on public.ipo_catalog for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and provider_id is null
    and data_source = 'USER_SUBMITTED'
    and manual_override_fields = '{}'::text[]
  );

comment on column public.ipo_catalog.submitted_by is
  'Verified user who submitted a manual shared-catalog entry. Administrators manage the record after submission.';
comment on column public.ipo_catalog.source_reference is
  'Optional source supplied with a manual or user-submitted shared-catalog record.';
