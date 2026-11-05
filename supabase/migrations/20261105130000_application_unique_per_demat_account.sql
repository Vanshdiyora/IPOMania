drop index if exists public.applications_user_ipo_unique;

create unique index applications_user_ipo_account_unique
  on public.applications (user_id, ipo_id, demat_account_id)
  where archived_at is null;
