begin;

grant insert (id) on public.demat_accounts to authenticated;

commit;
