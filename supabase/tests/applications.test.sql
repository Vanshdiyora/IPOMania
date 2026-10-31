begin;

select plan(16);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'applications-a@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Applications A"}',
    now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'applications-b@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Applications B"}',
    now(), now()
  );

insert into public.ipos (
  id, user_id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
  cut_off_price, lot_size, issue_size, opening_date, closing_date, status
)
values
  (
    '88888888-8888-4888-8888-888888888888',
    '11111111-1111-4111-8111-111111111111',
    'Application IPO A', 'APPA', 'Test', 'Test Exchange', 10, 20, 20, 10, 100000,
    '2026-11-01', '2026-11-03', 'UPCOMING'
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    '22222222-2222-4222-8222-222222222222',
    'Application IPO B', 'APPB', 'Test', 'Test Exchange', 10, 20, 20, 10, 100000,
    '2026-11-01', '2026-11-03', 'UPCOMING'
  );

insert into public.ipo_categories (
  id, user_id, ipo_id, category, rule_version, lot_limit_status, minimum_lots, maximum_lots,
  lot_increment, investment_limit_status, eligibility_conditions, allowed_price_types, rule_source
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888', 'RETAIL', 1, 'CONFIGURED', 1, 3, 1,
    'NO_PUBLISHED_LIMIT', '[]', array['CUT_OFF'], 'MANUAL'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    '99999999-9999-4999-8999-999999999999', 'RETAIL', 1, 'CONFIGURED', 1, 3, 1,
    'NO_PUBLISHED_LIMIT', '[]', array['CUT_OFF'], 'MANUAL'
  );

insert into public.demat_accounts (
  id, user_id, holder_name, broker_name, depository_type, masked_demat_identifier
)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '11111111-1111-4111-8111-111111111111', 'Application Holder A', 'Test Broker',
    'NSDL', 'XXXXAPPA'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '22222222-2222-4222-8222-222222222222', 'Application Holder B', 'Test Broker',
    'NSDL', 'XXXXAPPB'
  );

insert into public.applications (
  id, user_id, ipo_id, demat_account_id, category_id, lots, total_shares,
  application_amount, application_number, external_reference, application_status,
  mandate_status, allotment_status, rule_version, calculation_snapshot
)
values
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    1, 10, 200, 'APP-A-1', 'stable-a-1', 'DRAFT', 'UNKNOWN', 'UNKNOWN', 1,
    '{"calculation_result":{"application_amount":"200","total_shares":10},"category_rules":{"rule_version":1}}'
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '22222222-2222-4222-8222-222222222222',
    '99999999-9999-4999-8999-999999999999',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    1, 10, 200, 'APP-B-1', 'stable-b-1', 'DRAFT', 'UNKNOWN', 'UNKNOWN', 1,
    '{"calculation_result":{"application_amount":"200","total_shares":10},"category_rules":{"rule_version":1}}'
  );

insert into public.application_imports (
  id, user_id, file_name, file_type, status, total_rows
)
values (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'applications.csv', 'text/csv', 'preview', 1
);
insert into public.application_import_rows (
  import_id, row_number, record, row_status
)
values (
  '55555555-5555-4555-8555-555555555555',
  2,
  '{
    "user_id":"11111111-1111-4111-8111-111111111111",
    "ipo_id":"88888888-8888-4888-8888-888888888888",
    "demat_account_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "category_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "lots":1,"total_shares":10,"application_amount":"200",
    "application_number":"APP-A-2","external_reference":"stable-a-2",
    "submission_date":null,"application_status":"DRAFT",
    "mandate_status":"UNKNOWN","allotment_status":"UNKNOWN",
    "notes":null,"rule_version":1,
    "calculation_snapshot":{"calculation_result":{"application_amount":"200"}}
  }'::jsonb,
  'ready'
);

select is(
  (select relforcerowsecurity from pg_class where oid = 'public.applications'::regclass),
  true,
  'Application rows force RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.application_imports'::regclass),
  true,
  'Application import history forces RLS'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is((select count(*) from public.applications), 1::bigint, 'User A reads only their applications');
select is(
  (select count(*) from public.applications where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
  0::bigint,
  'User A cannot read User B applications'
);
select lives_ok(
  $$update public.applications
    set application_status = 'SUBMITTED', mandate_status = 'PENDING', allotment_status = 'PENDING'
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$,
  'Application, mandate, and allotment statuses update independently'
);
select is(
  (select calculation_snapshot->'calculation_result'->>'application_amount'
    from public.applications where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  '200',
  'Status edits preserve the historical calculation snapshot'
);
select throws_ok(
  $$update public.applications set calculation_snapshot = '{}'::jsonb
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$,
  '42501',
  'permission denied for table applications',
  'Application calculation snapshots cannot be overwritten by clients'
);
select throws_ok(
  $$insert into public.applications (
      user_id, ipo_id, demat_account_id, category_id, lots, total_shares,
      application_amount, rule_version, calculation_snapshot
    ) values (
      '22222222-2222-4222-8222-222222222222',
      '99999999-9999-4999-8999-999999999999',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      1, 10, 200, 1, '{}'::jsonb
    )$$,
  '42501',
  'new row violates row-level security policy for table "applications"',
  'User A cannot create an application for User B'
);
select throws_ok(
  $$insert into public.applications (
      user_id, ipo_id, demat_account_id, category_id, lots, total_shares,
      application_amount, external_reference, rule_version, calculation_snapshot
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '88888888-8888-4888-8888-888888888888',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      1, 10, 200, 'stable-a-1', 1, '{}'::jsonb
    )$$,
  '23505',
  'duplicate key value violates unique constraint "applications_external_reference_unique"',
  'Duplicate external references are rejected atomically'
);
select is(
  public.confirm_application_import('55555555-5555-4555-8555-555555555555')->>'imported_rows',
  '1',
  'Import confirmation creates the staged application'
);
select is(
  public.confirm_application_import('55555555-5555-4555-8555-555555555555')->>'imported_rows',
  '1',
  'Retry returns the stored import result'
);
select is((select count(*) from public.applications), 2::bigint, 'Retry does not create duplicates');
select is(
  public.reverse_application_import('55555555-5555-4555-8555-555555555555')->>'archived_rows',
  '1',
  'Import reversal archives only import-created applications'
);
select is(
  (select archived_at is not null from public.applications where external_reference = 'stable-a-2'),
  true,
  'Reversal retains the imported application as archived history'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*) from public.applications), 1::bigint, 'User B reads only their own application');
select is(
  (select count(*) from public.applications where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  0::bigint,
  'User B cannot read User A application history'
);

select * from finish();
rollback;
