create extension if not exists pg_trgm with schema extensions;

create table public.user_demat_account_capacity (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_count integer not null default 0 check (active_count between 0 and 500)
);

create table public.demat_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  holder_name text not null check (char_length(btrim(holder_name)) between 1 and 160),
  broker_name text not null check (char_length(btrim(broker_name)) between 1 and 120),
  broker_code text check (broker_code is null or char_length(btrim(broker_code)) between 1 and 40),
  depository_type text not null check (depository_type in ('NSDL', 'CDSL')),
  masked_demat_identifier text not null
    check (char_length(btrim(masked_demat_identifier)) between 3 and 80),
  masked_demat_identifier_normalized text generated always as
    (lower(btrim(masked_demat_identifier))) stored,
  masked_client_reference text
    check (
      masked_client_reference is null
      or (
        char_length(btrim(masked_client_reference)) between 3 and 80
        and masked_client_reference ~ '[xX*]'
      )
    ),
  account_status text not null default 'active'
    check (account_status in ('active', 'inactive', 'closed')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint demat_accounts_masked_identifier_format
    check (masked_demat_identifier ~ '^[[:print:]]+$' and masked_demat_identifier ~ '[xX*]')
);

create unique index demat_accounts_unique_masked_identity
  on public.demat_accounts (user_id, depository_type, masked_demat_identifier_normalized);
create index demat_accounts_owner_created_idx
  on public.demat_accounts (user_id, created_at desc, id);
create index demat_accounts_owner_broker_idx
  on public.demat_accounts (user_id, lower(broker_name));
create index demat_accounts_owner_depository_status_idx
  on public.demat_accounts (user_id, depository_type, account_status, archived_at);
create index demat_accounts_owner_active_capacity_idx
  on public.demat_accounts (user_id)
  where account_status = 'active' and archived_at is null;
create index demat_accounts_owner_holder_trgm_idx
  on public.demat_accounts using gin (holder_name extensions.gin_trgm_ops);
create index demat_accounts_owner_broker_trgm_idx
  on public.demat_accounts using gin (broker_name extensions.gin_trgm_ops);

create table public.account_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_type text not null check (file_type in ('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  status text not null default 'preview' check (status in ('preview', 'confirmed', 'reversed')),
  total_rows integer not null check (total_rows between 1 and 500),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  reversed_at timestamptz
);

create index account_imports_owner_created_idx
  on public.account_imports (user_id, created_at desc, id);

create table public.account_import_rows (
  import_id uuid not null references public.account_imports (id) on delete cascade,
  row_number integer not null check (row_number between 1 and 500),
  record jsonb not null,
  row_status text not null check (row_status in ('ready', 'duplicate', 'invalid', 'imported')),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  created_account_id uuid references public.demat_accounts (id) on delete set null,
  primary key (import_id, row_number)
);

create index account_import_rows_import_status_idx
  on public.account_import_rows (import_id, row_status, row_number);

alter table public.demat_accounts enable row level security;
alter table public.demat_accounts force row level security;
alter table public.user_demat_account_capacity enable row level security;
alter table public.user_demat_account_capacity force row level security;
alter table public.account_imports enable row level security;
alter table public.account_imports force row level security;
alter table public.account_import_rows enable row level security;
alter table public.account_import_rows force row level security;

create policy "Users can read their own demat accounts"
  on public.demat_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own demat accounts"
  on public.demat_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own demat accounts"
  on public.demat_accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete only their archived demat accounts"
  on public.demat_accounts for delete to authenticated
  using ((select auth.uid()) = user_id and archived_at is not null);

create policy "Users can read their own account imports"
  on public.account_imports for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own account imports"
  on public.account_imports for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own unconfirmed account imports"
  on public.account_imports for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'preview');
create policy "Users can read their own account import rows"
  on public.account_import_rows for select to authenticated
  using (exists (
    select 1 from public.account_imports i
    where i.id = import_id and i.user_id = (select auth.uid())
  ));
create policy "Users can create their own account import rows"
  on public.account_import_rows for insert to authenticated
  with check (exists (
    select 1 from public.account_imports i
    where i.id = import_id and i.user_id = (select auth.uid())
  ));

revoke all on public.demat_accounts, public.account_imports, public.account_import_rows,
  public.user_demat_account_capacity from public, anon, authenticated;
grant select, delete on public.demat_accounts to authenticated;
grant insert (user_id, holder_name, broker_name, broker_code, depository_type,
  masked_demat_identifier, masked_client_reference, account_status, notes, archived_at)
  on public.demat_accounts to authenticated;
grant update (holder_name, broker_name, broker_code, depository_type,
  masked_demat_identifier, masked_client_reference, account_status, notes, archived_at)
  on public.demat_accounts to authenticated;
grant select, delete on public.account_imports to authenticated;
grant insert (user_id, file_name, file_type, total_rows)
  on public.account_imports to authenticated;
grant select on public.account_import_rows to authenticated;
grant insert (import_id, row_number, record, row_status, errors, warnings)
  on public.account_import_rows to authenticated;

create trigger demat_accounts_set_updated_at
  before update on public.demat_accounts
  for each row execute function public.set_updated_at();

create function public.enforce_demat_account_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_active boolean;
  new_active boolean;
begin
  if tg_op <> 'INSERT' then
    old_active := old.archived_at is null and old.account_status = 'active';
  end if;

  if tg_op <> 'DELETE' then
    new_active := new.archived_at is null and new.account_status = 'active';
  end if;

  if tg_op = 'UPDATE'
    and old.user_id = new.user_id
    and old_active = new_active then
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old_active then
      update public.user_demat_account_capacity
      set active_count = active_count - 1
      where user_id = old.user_id and active_count > 0;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old_active then
    update public.user_demat_account_capacity
    set active_count = active_count - 1
    where user_id = old.user_id and active_count > 0;
    if not found then
      raise exception using
        errcode = '23514',
        message = 'ACTIVE_ACCOUNT_COUNTER_INCONSISTENT';
    end if;
  end if;

  if not new_active then
    return new;
  end if;

  insert into public.user_demat_account_capacity (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;

  update public.user_demat_account_capacity
  set active_count = active_count + 1
  where user_id = new.user_id and active_count < 500;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'ACTIVE_ACCOUNT_LIMIT',
      detail = 'A user may have at most 500 active demat accounts.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_demat_account_capacity() from public, anon, authenticated;

create trigger demat_accounts_enforce_capacity
  before insert or update of user_id, account_status, archived_at
  on public.demat_accounts
  for each row execute function public.enforce_demat_account_capacity();

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

  if auth.uid() is null or import_record.user_id <> auth.uid() then
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
      user_id, holder_name, broker_name, broker_code, depository_type,
      masked_demat_identifier, masked_client_reference, account_status, notes
    ) values (
      import_record.user_id,
      import_row.record->>'holder_name',
      import_row.record->>'broker_name',
      nullif(import_row.record->>'broker_code', ''),
      import_row.record->>'depository_type',
      import_row.record->>'masked_demat_identifier',
      nullif(import_row.record->>'masked_client_reference', ''),
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

create function public.reverse_account_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.account_imports%rowtype;
  archived_count integer;
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

  if auth.uid() is null or import_record.user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'IMPORT_NOT_OWNED';
  end if;

  if import_record.status = 'reversed' then
    return jsonb_build_object('import_id', p_import_id, 'status', 'reversed');
  end if;

  if import_record.status <> 'confirmed' then
    raise exception using errcode = '23514', message = 'IMPORT_NOT_REVERSIBLE';
  end if;

  update public.demat_accounts a
  set archived_at = now()
  from public.account_import_rows r
  where r.import_id = p_import_id
    and r.row_status = 'imported'
    and r.created_account_id = a.id
    and a.archived_at is null
    and a.created_at = a.updated_at;
  get diagnostics archived_count = row_count;

  if archived_count <> import_record.imported_rows then
    raise exception using
      errcode = '23514',
      message = 'IMPORT_REVERSAL_BLOCKED',
      detail = 'One or more imported accounts have changed and cannot be reversed safely.';
  end if;

  update public.account_imports
  set status = 'reversed', reversed_at = now()
  where id = p_import_id;

  return jsonb_build_object(
    'import_id', p_import_id,
    'archived_rows', archived_count,
    'status', 'reversed'
  );
end;
$$;

revoke execute on function public.confirm_account_import(uuid) from public, anon;
revoke execute on function public.reverse_account_import(uuid) from public, anon;
grant execute on function public.confirm_account_import(uuid) to authenticated;
grant execute on function public.reverse_account_import(uuid) to authenticated;
