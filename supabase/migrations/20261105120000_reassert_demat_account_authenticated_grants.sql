begin;

-- Reconcile grants with the account credential schema. RLS policies continue to enforce ownership.
revoke all on table public.demat_accounts from public, anon, authenticated;

grant select, delete on table public.demat_accounts to authenticated;
grant insert (user_id, holder_name, bank_name, username, password_encrypted,
  account_status, notes, archived_at)
  on public.demat_accounts to authenticated;
grant update (holder_name, bank_name, username, password_encrypted,
  account_status, notes, archived_at)
  on public.demat_accounts to authenticated;

commit;
