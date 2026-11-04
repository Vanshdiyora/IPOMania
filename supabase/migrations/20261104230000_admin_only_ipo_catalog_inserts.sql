drop policy if exists "Users submit shared IPO catalog entries" on public.ipo_catalog;

comment on column public.ipo_catalog.submitted_by is
  'Verified user associated with a legacy user-submitted catalog entry, retained for audit history.';
