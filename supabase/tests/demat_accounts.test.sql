begin;

select plan(34);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'accounts-user-a@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Account User A"}',
    now(), now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'accounts-user-b@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Account User B"}',
    now(), now()
  );

select is(
  (select relrowsecurity from pg_class where oid = 'public.demat_accounts'::regclass),
  true,
  'demat_accounts has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.demat_accounts'::regclass),
  true,
  'demat_accounts forces RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.account_imports'::regclass),
  true,
  'account_imports has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.account_import_rows'::regclass),
  true,
  'account_import_rows has RLS enabled'
);

insert into public.demat_accounts (
  user_id, holder_name, broker_name, depository_type, masked_demat_identifier
)
select
  '33333333-3333-4333-8333-333333333333',
  'Seed Account ' || n,
  'Test Broker',
  'NSDL',
  'XXXX' || lpad(n::text, 6, '0')
from generate_series(1, 499) as n;

insert into public.demat_accounts (
  user_id, holder_name, broker_name, depository_type, masked_demat_identifier
)
values (
  '44444444-4444-4444-8444-444444444444',
  'User B Account',
  'Test Broker',
  'CDSL',
  'XXXXB000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select is(
  (select count(*) from public.demat_accounts
   where user_id = '33333333-3333-4333-8333-333333333333'),
  499::bigint,
  'User A can read their seeded accounts'
);
select is(
  (select count(*) from public.demat_accounts
   where user_id = '44444444-4444-4444-8444-444444444444'),
  0::bigint,
  'User A cannot read User B accounts'
);

select lives_ok(
  $$insert into public.demat_accounts
    (user_id, holder_name, broker_name, depository_type, masked_demat_identifier)
    values ('33333333-3333-4333-8333-333333333333', 'At Capacity', 'Test Broker', 'CDSL', 'XXXXCAPACITY500')$$,
  'User A can create the 500th active account'
);
select is(
  (select count(*) from public.demat_accounts
   where user_id = '33333333-3333-4333-8333-333333333333'
     and account_status = 'active' and archived_at is null),
  500::bigint,
  'User A has exactly 500 active unarchived accounts'
);
select throws_ok(
  $$insert into public.demat_accounts
    (user_id, holder_name, broker_name, depository_type, masked_demat_identifier)
    values ('33333333-3333-4333-8333-333333333333', 'Over Limit', 'Test Broker', 'CDSL', 'XXXXCAPACITY501')$$,
  '23514',
  null,
  'The database rejects a 501st active account'
);

select lives_ok(
  $$update public.demat_accounts set archived_at = now()
    where user_id = '33333333-3333-4333-8333-333333333333'
      and masked_demat_identifier = 'XXXX000001'$$,
  'Archiving an account is allowed at capacity'
);
select is(
  (select count(*) from public.demat_accounts
   where user_id = '33333333-3333-4333-8333-333333333333'
     and account_status = 'active' and archived_at is null),
  499::bigint,
  'Archived accounts do not count toward the active limit'
);
select lives_ok(
  $$insert into public.demat_accounts
    (user_id, holder_name, broker_name, depository_type, masked_demat_identifier)
    values ('33333333-3333-4333-8333-333333333333', 'Replacement at Capacity', 'Test Broker', 'CDSL', 'XXXXREPLACEMENT500')$$,
  'A new active account can use the capacity freed by archiving'
);
select throws_ok(
  $$update public.demat_accounts set archived_at = null
    where user_id = '33333333-3333-4333-8333-333333333333'
      and masked_demat_identifier = 'XXXX000001'$$,
  '23514',
  null,
  'Restoring an active account is rejected when it would exceed the limit'
);
select lives_ok(
  $$update public.demat_accounts
    set account_status = 'inactive', archived_at = null
    where user_id = '33333333-3333-4333-8333-333333333333'
      and masked_demat_identifier = 'XXXX000001'$$,
  'Restoring an inactive account does not consume active capacity'
);
select lives_ok(
  $$update public.demat_accounts set account_status = 'inactive'
    where user_id = '33333333-3333-4333-8333-333333333333'
      and masked_demat_identifier = 'XXXXREPLACEMENT500'$$,
  'Changing the replacement account to inactive frees active capacity'
);
select is(
  (select count(*) from public.demat_accounts
   where user_id = '33333333-3333-4333-8333-333333333333'
     and account_status = 'active' and archived_at is null),
  499::bigint,
  'Inactive restored account is excluded from active count'
);
select lives_ok(
  $$update public.demat_accounts set archived_at = now()
    where user_id = '33333333-3333-4333-8333-333333333333'
      and masked_demat_identifier = 'XXXX000001'$$,
  'Inactive account can be archived'
);
select lives_ok(
  $$delete from public.demat_accounts
    where user_id = '33333333-3333-4333-8333-333333333333'
      and masked_demat_identifier = 'XXXX000001'$$,
  'An archived account can be permanently deleted'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select is(
  (select count(*) from public.demat_accounts
   where user_id = '44444444-4444-4444-8444-444444444444'),
  1::bigint,
  'User B can read their own account'
);
select is(
  (select count(*) from public.demat_accounts
   where user_id = '33333333-3333-4333-8333-333333333333'),
  0::bigint,
  'User B cannot read User A accounts'
);
select throws_ok(
  $$update public.demat_accounts
    set user_id = '33333333-3333-4333-8333-333333333333'
    where user_id = '44444444-4444-4444-8444-444444444444'$$,
  '42501',
  'permission denied for table demat_accounts',
  'User B cannot change account ownership'
);
select throws_ok(
  $$insert into public.demat_accounts
    (user_id, holder_name, broker_name, depository_type, masked_demat_identifier)
    values ('44444444-4444-4444-8444-444444444444', 'Bad Depository', 'Test Broker', 'INVALID', 'INVALIDDEP')$$,
  '23514',
  null,
  'Invalid depository values are rejected'
);
select throws_ok(
  $$insert into public.demat_accounts
    (user_id, holder_name, broker_name, depository_type, masked_demat_identifier)
    values ('44444444-4444-4444-8444-444444444444', 'Bad Broker', ' ', 'NSDL', 'BADBROKER')$$,
  '23514',
  null,
  'Blank broker values are rejected'
);
select throws_ok(
  $$insert into public.demat_accounts
    (user_id, holder_name, broker_name, depository_type, masked_demat_identifier)
    values ('44444444-4444-4444-8444-444444444444', 'Duplicate', 'Test Broker', 'CDSL', 'XXXXB000001')$$,
  '23505',
  null,
  'Duplicate masked demat identifiers are rejected per user and depository'
);
select throws_ok(
  $$select * from public.user_demat_account_capacity
    where user_id = '44444444-4444-4444-8444-444444444444'$$,
  '42501',
  'permission denied for table user_demat_account_capacity',
  'Clients cannot read private capacity counters'
);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select lives_ok(
  $$insert into public.account_imports (user_id, file_name, file_type, total_rows)
    values (
      '33333333-3333-4333-8333-333333333333',
      'accounts.csv',
      'text/csv',
      1
    )$$,
  'User A can create an owned import history record'
);
select lives_ok(
  $$insert into public.account_import_rows (import_id, row_number, record, row_status)
    values (
      (select id from public.account_imports
       where user_id = '33333333-3333-4333-8333-333333333333'
         and file_name = 'accounts.csv'),
      1,
      '{"holder_name":"Imported Holder","broker_name":"Test Broker","depository_type":"CDSL","masked_demat_identifier":"XXXXIMPORT0001","account_status":"active"}',
      'ready'
    )$$,
  'User A can stage a validated import row'
);
select is(
  public.confirm_account_import((
    select id from public.account_imports
    where user_id = '33333333-3333-4333-8333-333333333333'
      and file_name = 'accounts.csv'
  ))->>'imported_rows',
  '1',
  'Confirm imports the staged row atomically'
);
select is(
  public.confirm_account_import((
    select id from public.account_imports
    where user_id = '33333333-3333-4333-8333-333333333333'
      and file_name = 'accounts.csv'
  ))->>'imported_rows',
  '1',
  'Retrying confirmation returns the existing result without duplication'
);
select ok(
  (select created_account_id is not null
   from public.account_import_rows
   where import_id = (
     select id from public.account_imports
     where user_id = '33333333-3333-4333-8333-333333333333'
       and file_name = 'accounts.csv'
   )),
  'The import report links the created account'
);
select is(
  public.reverse_account_import((
    select id from public.account_imports
    where user_id = '33333333-3333-4333-8333-333333333333'
      and file_name = 'accounts.csv'
  ))->>'archived_rows',
  '1',
  'Reversing an unchanged import archives its created account'
);
select is(
  (select status from public.account_imports
   where user_id = '33333333-3333-4333-8333-333333333333'
     and file_name = 'accounts.csv'),
  'reversed',
  'Import reversal is recorded in history'
);
select is(
  public.reverse_account_import((
    select id from public.account_imports
    where user_id = '33333333-3333-4333-8333-333333333333'
      and file_name = 'accounts.csv'
  ))->>'status',
  'reversed',
  'Retrying reversal returns the existing result'
);
reset role;
select is(
  (select active_count from public.user_demat_account_capacity
   where user_id = '33333333-3333-4333-8333-333333333333'),
  499,
  'The private counter stays consistent after import reversal'
);

select * from finish();
rollback;
