begin;

-- The API creates the UUID before encryption so it can bind ciphertext to the account record.
grant insert (id) on public.demat_accounts to authenticated;

commit;
