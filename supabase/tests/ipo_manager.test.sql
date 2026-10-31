begin;

select plan(23);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '66666666-6666-4666-8666-666666666666',
    'authenticated', 'authenticated', 'ipo-user-a@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"IPO User A"}',
    now(), now()
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'authenticated', 'authenticated', 'ipo-user-b@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"IPO User B"}',
    now(), now()
  );

insert into public.ipos (
  id, user_id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
  cut_off_price, lot_size, issue_size, opening_date, closing_date, status
)
values
  (
    '88888888-8888-4888-8888-888888888888',
    '66666666-6666-4666-8666-666666666666', 'IPO Test A', 'IPOA', 'Test', 'Test Exchange',
    10, 20, 20, 10, 100000, '2026-11-01', '2026-11-03', 'UPCOMING'
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    '77777777-7777-4777-8777-777777777777', 'IPO Test B', 'IPOB', 'Test', 'Test Exchange',
    10, 20, 20, 10, 100000, '2026-11-01', '2026-11-03', 'UPCOMING'
  );

insert into public.ipo_categories (
  id, user_id, ipo_id, category, rule_version, lot_limit_status, lot_increment,
  investment_limit_status, eligibility_conditions, allowed_price_types, rule_source
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '66666666-6666-4666-8666-666666666666',
    '88888888-8888-4888-8888-888888888888', 'RETAIL', 1, 'UNCONFIGURED', 1,
    'UNCONFIGURED', '[]', array['BID'], 'MANUAL'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '77777777-7777-4777-8777-777777777777',
    '99999999-9999-4999-8999-999999999999', 'RETAIL', 1, 'UNCONFIGURED', 1,
    'UNCONFIGURED', '[]', array['BID'], 'MANUAL'
  );

insert into public.demat_accounts (
  id, user_id, holder_name, broker_name, depository_type, masked_demat_identifier
)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '66666666-6666-4666-8666-666666666666', 'IPO Holder A', 'Test Broker', 'NSDL', 'XXXXIPOA'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '77777777-7777-4777-8777-777777777777', 'IPO Holder B', 'Test Broker', 'NSDL', 'XXXXIPOB'
  );

select is(
  (select relrowsecurity from pg_class where oid = 'public.ipos'::regclass),
  true,
  'IPO records enable RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.ipos'::regclass),
  true,
  'IPO records force RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.ipo_categories'::regclass),
  true,
  'IPO category rules force RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.ipo_quota_calculations'::regclass),
  true,
  'Quota calculations force RLS'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);

select is(
  (select count(*) from public.ipos),
  1::bigint,
  'User A reads only their IPO master records'
);
select is(
  (select count(*) from public.ipos where id = '99999999-9999-4999-8999-999999999999'),
  0::bigint,
  'User A cannot read User B IPO records'
);
select lives_ok(
  $$insert into public.ipos (
      user_id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
      lot_size, issue_size, opening_date, closing_date, status
    ) values (
      '66666666-6666-4666-8666-666666666666', 'Owned IPO', 'OWNED', 'Test',
      'Test Exchange', 10, 20, 10, 100000, '2026-11-01', '2026-11-03', 'UPCOMING'
    )$$,
  'User A can create an owned IPO record'
);
select throws_ok(
  $$insert into public.ipos (
      user_id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
      lot_size, issue_size, opening_date, closing_date, status
    ) values (
      '77777777-7777-4777-8777-777777777777', 'Forged IPO', 'FORGED', 'Test',
      'Test Exchange', 10, 20, 10, 100000, '2026-11-01', '2026-11-03', 'UPCOMING'
    )$$,
  '42501',
    'new row violates row-level security policy for table "ipos"',
  'User A cannot create an IPO for User B'
);
select throws_ok(
  $$update public.ipos set user_id = '77777777-7777-4777-8777-777777777777'
    where id = '88888888-8888-4888-8888-888888888888'$$,
  '42501',
  'permission denied for table ipos',
  'User A cannot transfer an IPO record'
);
select is(
  (select count(*) from public.ipo_categories),
  1::bigint,
  'User A reads only their category rule versions'
);
select lives_ok(
  $$insert into public.ipo_categories (
      user_id, ipo_id, category, lot_limit_status, lot_increment,
      investment_limit_status, eligibility_conditions, allowed_price_types
    ) values (
      '66666666-6666-4666-8666-666666666666',
      '88888888-8888-4888-8888-888888888888', 'RETAIL', 'UNCONFIGURED', 1,
      'UNCONFIGURED',
      '[{"id":"test_condition","description":"Manual test condition"}]'::jsonb,
      array['BID']
    )$$,
  'User A can add a structured issue-specific category rule version'
);
select is(
  (select max(rule_version) from public.ipo_categories where ipo_id = '88888888-8888-4888-8888-888888888888' and category = 'RETAIL'),
  2,
  'New category rules receive a database-assigned version'
);
select is(
  (select count(*) from public.ipo_categories where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0::bigint,
  'User A cannot read User B category rule details'
);
select throws_ok(
  $$insert into public.ipo_categories (
      user_id, ipo_id, category, lot_limit_status, lot_increment,
      investment_limit_status, eligibility_conditions, allowed_price_types
    ) values (
      '66666666-6666-4666-8666-666666666666',
      '88888888-8888-4888-8888-888888888888', 'BHNI', 'UNCONFIGURED', 1,
      'UNCONFIGURED', '[{"id":"x","description":"test","arbitrary":true}]'::jsonb,
      array['BID']
    )$$,
  '23514',
  'new row for relation "ipo_categories" violates check constraint "ipo_categories_eligibility_conditions_check"',
  'Database rejects unstructured category rule JSON'
);
select throws_ok(
  $$update public.ipo_categories set lot_increment = 2
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  'permission denied for table ipo_categories',
  'Category rule versions cannot be edited'
);
select lives_ok(
  $$insert into public.ipo_quota_calculations (
      user_id, ipo_id, category_configuration_id, demat_account_id, category, rule_version,
      input_snapshot, result_snapshot
    ) values (
      '66666666-6666-4666-8666-666666666666',
      '88888888-8888-4888-8888-888888888888',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'RETAIL', 1,
      '{"price":"10.00","lots":1}'::jsonb, '{"eligible":false}'::jsonb
    )$$,
  'User A can store their reproducible calculation snapshot'
);
select throws_ok(
  $$insert into public.ipo_quota_calculations (
      user_id, ipo_id, category_configuration_id, demat_account_id, category, rule_version,
      input_snapshot, result_snapshot
    ) values (
      '66666666-6666-4666-8666-666666666666',
      '88888888-8888-4888-8888-888888888888',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'RETAIL', 1,
      '{"price":"10.00","lots":1}'::jsonb, '{"eligible":false}'::jsonb
    )$$,
  '23503',
  'insert or update on table "ipo_quota_calculations" violates foreign key constraint "ipo_quota_calculations_owner_account_fk"',
  'A calculation cannot reference another user demat account'
);
select is(
  (select count(*) from public.ipo_quota_calculations),
  1::bigint,
  'User A reads only their quota calculation history'
);

select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
select is(
  (select count(*) from public.ipos),
  1::bigint,
  'User B reads only their IPO record'
);
select is(
  (select count(*) from public.ipo_categories),
  1::bigint,
  'User B reads only their IPO category rules'
);
select is(
  (select count(*) from public.ipo_quota_calculations),
  0::bigint,
  'User B cannot read User A calculation inputs or results'
);
select throws_ok(
  $$insert into public.ipo_quota_calculations (
      user_id, ipo_id, category_configuration_id, demat_account_id, category, rule_version,
      input_snapshot, result_snapshot
    ) values (
      '77777777-7777-4777-8777-777777777777',
      '88888888-8888-4888-8888-888888888888',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'RETAIL', 1, '{}'::jsonb, '{}'::jsonb
    )$$,
  '23503',
  'insert or update on table "ipo_quota_calculations" violates foreign key constraint "ipo_quota_calculations_owner_ipo_fk"',
  'User B cannot create a calculation for User A IPO rules'
);
select throws_ok(
  $$update public.ipo_quota_calculations set result_snapshot = '{"eligible":true}'::jsonb$$,
  '42501',
  'permission denied for table ipo_quota_calculations',
  'Calculation audit records cannot be changed'
);

select * from finish();
rollback;
