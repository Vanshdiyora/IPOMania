begin;

drop function if exists public.confirm_account_import(uuid);

do $$
declare
  analytics_definition text;
begin
  analytics_definition := pg_get_functiondef(
    'public.get_dashboard_analytics(date,date,uuid,text,uuid,integer)'::regprocedure
  );
  analytics_definition := replace(analytics_definition, 'masked_demat_identifier', 'bank_name');
  execute analytics_definition;
end;
$$;

drop index if exists public.demat_accounts_unique_masked_identity;
drop index if exists public.demat_accounts_owner_depository_status_idx;

alter table public.demat_accounts
  add column bank_name text,
  add column bank_name_normalized text
    generated always as (lower(btrim(bank_name))) stored,
  add column username text,
  add column username_normalized text
    generated always as (lower(btrim(username))) stored,
  add column password_encrypted text,
  add constraint demat_accounts_bank_name_length
    check (bank_name is null or char_length(btrim(bank_name)) between 1 and 120),
  add constraint demat_accounts_username_length
    check (username is null or char_length(btrim(username)) between 1 and 160),
  add constraint demat_accounts_password_ciphertext_format
    check (password_encrypted is null or password_encrypted ~ '^v1[.][A-Za-z0-9+/]+=*$');

alter table public.demat_accounts
  drop column depository_type,
  drop column masked_demat_identifier,
  drop column masked_demat_identifier_normalized,
  drop column masked_client_reference;

create index demat_accounts_owner_bank_idx
  on public.demat_accounts (user_id, bank_name_normalized);
create index demat_accounts_owner_username_idx
  on public.demat_accounts (user_id, username_normalized);

grant insert (user_id, holder_name, bank_name, username, password_encrypted,
  account_status, notes, archived_at)
  on public.demat_accounts to authenticated;
grant update (holder_name, bank_name, username, password_encrypted,
  account_status, notes, archived_at)
  on public.demat_accounts to authenticated;

update public.account_import_rows
set row_status = 'invalid',
    errors = errors || jsonb_build_array(
      'This preview predates bank account fields; upload the file again to import it.'
    )
where row_status = 'ready'
  and (
    nullif(record->>'bank_name', '') is null
    or nullif(record->>'username', '') is null
  );

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
  select * into import_record
  from public.account_imports
  where id = p_import_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'IMPORT_NOT_FOUND';
  end if;
  if import_record.user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'IMPORT_NOT_OWNED';
  end if;
  if import_record.status = 'confirmed' then
    return jsonb_build_object(
      'import_id', import_record.id,
      'imported_rows', import_record.imported_rows,
      'status', import_record.status
    );
  end if;
  if import_record.status <> 'preview' then
    raise exception using errcode = '23514', message = 'IMPORT_NOT_CONFIRMABLE';
  end if;

  for import_row in
    select * from public.account_import_rows
    where import_id = p_import_id and row_status = 'ready'
    order by row_number
    for update
  loop
    insert into public.demat_accounts (
      user_id, holder_name, bank_name, username, account_status, notes
    ) values (
      import_record.user_id,
      import_row.record->>'holder_name',
      import_row.record->>'bank_name',
      import_row.record->>'username',
      coalesce(nullif(import_row.record->>'account_status', ''), 'active'),
      nullif(import_row.record->>'notes', '')
    )
    returning id into new_account_id;

    update public.account_import_rows
    set created_account_id = new_account_id, row_status = 'imported'
    where import_id = p_import_id and row_number = import_row.row_number;
    inserted_count := inserted_count + 1;
  end loop;

  update public.account_imports
  set status = 'confirmed', imported_rows = inserted_count, confirmed_at = now()
  where id = p_import_id;

  return jsonb_build_object(
    'import_id', p_import_id,
    'imported_rows', inserted_count,
    'status', 'confirmed'
  );
end;
$$;

revoke execute on function public.confirm_account_import(uuid) from public, anon;
grant execute on function public.confirm_account_import(uuid) to authenticated;

commit;
