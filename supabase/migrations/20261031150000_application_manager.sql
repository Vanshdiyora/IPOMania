alter table public.demat_accounts
  add constraint demat_accounts_id_user_unique unique (id, user_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ipo_id uuid not null,
  demat_account_id uuid not null,
  category_id uuid not null,
  lots integer not null check (lots between 1 and 1000000),
  total_shares bigint not null check (total_shares > 0),
  application_amount numeric(28, 6) not null check (application_amount > 0),
  application_number text check (
    application_number is null or char_length(btrim(application_number)) between 1 and 120
  ),
  external_reference text check (
    external_reference is null or char_length(btrim(external_reference)) between 1 and 200
  ),
  submission_date timestamptz,
  application_status text not null default 'DRAFT'
    check (application_status in (
      'DRAFT', 'SUBMITTED', 'UNDER_PROCESSING', 'REJECTED', 'FAILED', 'COMPLETED'
    )),
  mandate_status text not null default 'UNKNOWN'
    check (mandate_status in (
      'UNKNOWN', 'PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'NOT_REQUIRED'
    )),
  allotment_status text not null default 'UNKNOWN'
    check (allotment_status in (
      'UNKNOWN', 'PENDING', 'ALLOTTED', 'PARTIALLY_ALLOTTED', 'NOT_ALLOTTED'
    )),
  notes text check (notes is null or char_length(notes) <= 2000),
  rule_version integer not null check (rule_version > 0),
  calculation_snapshot jsonb not null
    check (jsonb_typeof(calculation_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint applications_ipo_owner_fk
    foreign key (ipo_id, user_id) references public.ipos (id, user_id) on delete restrict,
  constraint applications_account_owner_fk
    foreign key (demat_account_id, user_id)
    references public.demat_accounts (id, user_id) on delete restrict,
  constraint applications_category_owner_issue_fk
    foreign key (category_id, ipo_id, user_id)
    references public.ipo_categories (id, ipo_id, user_id) on delete restrict,
  constraint applications_id_user_unique unique (id, user_id)
);

create unique index applications_external_reference_unique
  on public.applications (user_id, lower(btrim(external_reference)))
  where external_reference is not null;
create index applications_owner_created_idx
  on public.applications (user_id, created_at desc, id);
create index applications_owner_status_idx
  on public.applications (user_id, application_status, created_at desc);
create index applications_owner_issue_account_idx
  on public.applications (user_id, ipo_id, demat_account_id, category_id);
create index applications_owner_mandate_idx
  on public.applications (user_id, mandate_status, created_at desc);
create index applications_account_created_idx
  on public.applications (demat_account_id, created_at desc);

create table public.application_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_type text not null check (
    file_type in (
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  ),
  status text not null default 'preview'
    check (status in ('preview', 'confirmed', 'reversed')),
  total_rows integer not null check (total_rows between 1 and 500),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  reversed_at timestamptz
);
create index application_imports_owner_created_idx
  on public.application_imports (user_id, created_at desc, id);

create table public.application_import_rows (
  import_id uuid not null references public.application_imports (id) on delete cascade,
  row_number integer not null check (row_number between 1 and 500),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  row_status text not null
    check (row_status in ('ready', 'duplicate', 'invalid', 'imported')),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  created_application_id uuid references public.applications (id) on delete set null,
  primary key (import_id, row_number)
);
create index application_import_rows_status_idx
  on public.application_import_rows (import_id, row_status, row_number);

alter table public.applications enable row level security;
alter table public.applications force row level security;
alter table public.application_imports enable row level security;
alter table public.application_imports force row level security;
alter table public.application_import_rows enable row level security;
alter table public.application_import_rows force row level security;

create policy "Users can read their own applications"
  on public.applications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own applications"
  on public.applications for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own applications"
  on public.applications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can read their own application imports"
  on public.application_imports for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own application imports"
  on public.application_imports for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own unconfirmed application imports"
  on public.application_imports for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'preview');
create policy "Users can read their own application import rows"
  on public.application_import_rows for select to authenticated
  using (exists (
    select 1 from public.application_imports i
    where i.id = import_id and i.user_id = (select auth.uid())
  ));
create policy "Users can create their own application import rows"
  on public.application_import_rows for insert to authenticated
  with check (exists (
    select 1 from public.application_imports i
    where i.id = import_id and i.user_id = (select auth.uid())
  ));

revoke all on public.applications, public.application_imports, public.application_import_rows
  from public, anon, authenticated;
grant select on public.applications to authenticated;
grant update (
  application_number, external_reference, submission_date, application_status, mandate_status,
  allotment_status, notes, archived_at
) on public.applications to authenticated;
grant insert (
  user_id, ipo_id, demat_account_id, category_id, lots, total_shares, application_amount,
  application_number, external_reference, submission_date, application_status, mandate_status,
  allotment_status, notes, rule_version, calculation_snapshot
) on public.applications to authenticated;
grant select, delete on public.application_imports to authenticated;
grant insert (user_id, file_name, file_type, total_rows)
  on public.application_imports to authenticated;
grant select on public.application_import_rows to authenticated;
grant insert (import_id, row_number, record, row_status, errors, warnings)
  on public.application_import_rows to authenticated;

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

create function public.confirm_application_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.application_imports%rowtype;
  import_row public.application_import_rows%rowtype;
  application_id uuid;
  imported_count integer := 0;
  result_value jsonb;
begin
  select * into import_record
  from public.application_imports
  where id = p_import_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPLICATION_IMPORT_NOT_FOUND';
  end if;
  if import_record.status = 'confirmed' then
    return import_record.result;
  end if;
  if import_record.status <> 'preview' then
    raise exception using errcode = '23514', message = 'APPLICATION_IMPORT_NOT_CONFIRMABLE';
  end if;

  for import_row in
    select * from public.application_import_rows
    where import_id = p_import_id and row_status in ('ready', 'duplicate')
    order by row_number
    for update
  loop
    insert into public.applications (
      user_id, ipo_id, demat_account_id, category_id, lots, total_shares,
      application_amount, application_number, external_reference, submission_date,
      application_status, mandate_status, allotment_status, notes, rule_version,
      calculation_snapshot
    ) values (
      auth.uid(),
      (import_row.record->>'ipo_id')::uuid,
      (import_row.record->>'demat_account_id')::uuid,
      (import_row.record->>'category_id')::uuid,
      (import_row.record->>'lots')::integer,
      (import_row.record->>'total_shares')::bigint,
      (import_row.record->>'application_amount')::numeric,
      nullif(import_row.record->>'application_number', ''),
      nullif(import_row.record->>'external_reference', ''),
      nullif(import_row.record->>'submission_date', '')::timestamptz,
      import_row.record->>'application_status',
      import_row.record->>'mandate_status',
      import_row.record->>'allotment_status',
      nullif(import_row.record->>'notes', ''),
      (import_row.record->>'rule_version')::integer,
      import_row.record->'calculation_snapshot'
    ) returning id into application_id;
    update public.application_import_rows
    set row_status = 'imported', created_application_id = application_id
    where import_id = p_import_id and row_number = import_row.row_number;
    imported_count := imported_count + 1;
  end loop;

  result_value := pg_catalog.jsonb_build_object('imported_rows', imported_count);
  update public.application_imports
  set status = 'confirmed', imported_rows = imported_count, confirmed_at = now(), result = result_value
  where id = p_import_id;
  return result_value;
end;
$$;

create function public.reverse_application_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.application_imports%rowtype;
  application_count integer;
begin
  select * into import_record
  from public.application_imports
  where id = p_import_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPLICATION_IMPORT_NOT_FOUND';
  end if;
  if import_record.status <> 'confirmed' then
    raise exception using errcode = '23514', message = 'APPLICATION_IMPORT_NOT_REVERSIBLE';
  end if;
  if exists (
    select 1
    from public.application_import_rows r
    join public.applications a on a.id = r.created_application_id
    where r.import_id = p_import_id
      and (a.archived_at is not null or a.updated_at <> import_record.confirmed_at)
  ) then
    raise exception using errcode = '23514', message = 'APPLICATION_IMPORT_REVERSAL_BLOCKED';
  end if;
  update public.applications a
  set archived_at = now()
  from public.application_import_rows r
  where r.import_id = p_import_id and r.created_application_id = a.id;
  get diagnostics application_count = row_count;
  update public.application_imports
  set status = 'reversed', reversed_at = now()
  where id = p_import_id;
  return pg_catalog.jsonb_build_object('archived_rows', application_count);
end;
$$;

revoke all on function public.confirm_application_import(uuid) from public, anon;
revoke all on function public.reverse_application_import(uuid) from public, anon;
grant execute on function public.confirm_application_import(uuid) to authenticated;
grant execute on function public.reverse_application_import(uuid) to authenticated;
