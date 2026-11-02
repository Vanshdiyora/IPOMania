-- Account counts are unrestricted. Keep the original migration immutable for existing projects.
drop trigger if exists demat_accounts_enforce_capacity on public.demat_accounts;
drop function if exists public.enforce_demat_account_capacity();
drop index if exists public.demat_accounts_owner_active_capacity_idx;
drop table if exists public.user_demat_account_capacity;
