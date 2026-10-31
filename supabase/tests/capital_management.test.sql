begin;

select plan(41);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '12121212-1212-4121-8121-121212121212',
    'authenticated', 'authenticated', 'capital-user-a@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Capital User A"}',
    now(), now()
  ),
  (
    '23232323-2323-4232-8232-232323232323',
    'authenticated', 'authenticated', 'capital-user-b@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Capital User B"}',
    now(), now()
  );

insert into public.ipos (
  id, user_id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
  lot_size, issue_size, opening_date, closing_date, status
)
values
  (
    '34343434-3434-4434-8434-343434343434',
    '12121212-1212-4121-8121-121212121212',
    'Capital Test A', 'CAPA', 'Test', 'Test Exchange', 10, 20, 10, 100000,
    '2026-11-01', '2026-11-03', 'UPCOMING'
  ),
  (
    '45454545-4545-4454-8454-454545454545',
    '23232323-2323-4232-8232-232323232323',
    'Capital Test B', 'CAPB', 'Test', 'Test Exchange', 10, 20, 10, 100000,
    '2026-11-01', '2026-11-03', 'UPCOMING'
  );

insert into public.ipo_categories (
  id, user_id, ipo_id, category, lot_limit_status, minimum_lots, maximum_lots,
  lot_increment, investment_limit_status, maximum_investment,
  eligibility_conditions, allowed_price_types, rule_source
)
values
  (
    '56565656-5656-4565-8565-565656565656',
    '12121212-1212-4121-8121-121212121212',
    '34343434-3434-4434-8434-343434343434', 'RETAIL', 'CONFIGURED', 1, 3,
    1, 'CONFIGURED', 1000, '[]', array['BID'], 'MANUAL'
  ),
  (
    '67676767-6767-4676-8676-676767676767',
    '23232323-2323-4232-8232-232323232323',
    '45454545-4545-4454-8454-454545454545', 'RETAIL', 'CONFIGURED', 1, 3,
    1, 'CONFIGURED', 1000, '[]', array['BID'], 'MANUAL'
  );

insert into public.demat_accounts (
  id, user_id, holder_name, broker_name, depository_type, masked_demat_identifier
)
values
  (
    '78787878-7878-4787-8787-787878787878',
    '12121212-1212-4121-8121-121212121212',
    'Capital Holder A', 'Test Broker', 'NSDL', 'XXXXCAPA'
  ),
  (
    '89898989-8989-4898-8989-898989898989',
    '23232323-2323-4232-8232-232323232323',
    'Capital Holder B', 'Test Broker', 'NSDL', 'XXXXCAPB'
  );

insert into public.ipo_quota_calculations (
  id, user_id, ipo_id, category_configuration_id, demat_account_id, category, rule_version,
  input_snapshot, result_snapshot
)
values
  (
    '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a',
    '12121212-1212-4121-8121-121212121212',
    '34343434-3434-4434-8434-343434343434',
    '56565656-5656-4565-8565-565656565656',
    '78787878-7878-4787-8787-787878787878',
    'RETAIL', 1,
    '{"category":"RETAIL","lots":2,"price_type":"BID","price":"10","demat_account_id":"78787878-7878-4787-8787-787878787878","ipo":{"lot_size":10,"issue_price_min":"10","issue_price_max":"20","cut_off_price":null},"category_configuration":{"id":"56565656-5656-4565-8565-565656565656","rule_version":1},"eligibility_answers":{}}',
    '{"eligible":true,"total_shares":20,"application_amount":"200","category":"RETAIL","rule_version":1}'
  ),
  (
    'abababab-abab-4bab-8bab-abababababab',
    '23232323-2323-4232-8232-232323232323',
    '45454545-4545-4454-8454-454545454545',
    '67676767-6767-4676-8676-676767676767',
    '89898989-8989-4898-8989-898989898989',
    'RETAIL', 1,
    '{"category":"RETAIL","lots":2,"price_type":"BID","price":"10","demat_account_id":"89898989-8989-4898-8989-898989898989","ipo":{"lot_size":10,"issue_price_min":"10","issue_price_max":"20","cut_off_price":null},"category_configuration":{"id":"67676767-6767-4676-8676-676767676767","rule_version":1},"eligibility_answers":{}}',
    '{"eligible":true,"total_shares":20,"application_amount":"200","category":"RETAIL","rule_version":1}'
  );

select is(
  (select relforcerowsecurity from pg_class where oid = 'public.applications'::regclass),
  true,
  'Applications force RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.mandates'::regclass),
  true,
  'Mandates force RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.allotments'::regclass),
  true,
  'Allotments force RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.capital_ledger'::regclass),
  true,
  'Capital ledger forces RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.allotment_history'::regclass),
  true,
  'Allotment history forces RLS'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '12121212-1212-4121-8121-121212121212', true);

select lives_ok(
  $$insert into public.applications (
      user_id, ipo_id, demat_account_id, category_configuration_id, quota_calculation_id,
      category, rule_version, lot_size, issue_price_min, issue_price_max, cut_off_price,
      lots, shares, price_type, price, application_amount
    ) values (
      '12121212-1212-4121-8121-121212121212',
      '34343434-3434-4434-8434-343434343434',
      '78787878-7878-4787-8787-787878787878',
      '56565656-5656-4565-8565-565656565656',
      '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a',
      'RETAIL', 1, 10, 10, 20, null, 2, 20, 'BID', 10, 200
    )$$,
  'User A records an application from their eligible calculation'
);
select is((select count(*) from public.applications), 1::bigint, 'User A reads only their application');
select is(
  (select count(*) from public.capital_ledger where transaction_type = 'APPLICATION_RECORDED'),
  1::bigint,
  'Application recording creates one informational ledger event'
);
select lives_ok(
  $$insert into public.mandates (
      user_id, application_id, mandate_reference, mandate_amount
    ) values (
      '12121212-1212-4121-8121-121212121212',
      (select id from public.applications where quota_calculation_id = '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a'),
      'MANDATE-A-1', 200
    )$$,
  'User A creates a pending mandate'
);
select lives_ok(
  $$update public.mandates set mandate_status = 'APPROVED'
    where mandate_reference = 'MANDATE-A-1'$$,
  'User A manually approves the mandate'
);
select is(
  (select count(*) from public.capital_ledger where transaction_type = 'MANDATE_APPROVED'),
  1::bigint,
  'Manual approval creates an informational ledger event'
);
select is(
  (select count(*) from public.capital_ledger where transaction_type = 'ACTUAL_DEBIT'),
  0::bigint,
  'Mandate approval does not imply a completed debit'
);
select throws_ok(
  $$update public.mandates set mandate_status = 'PENDING'
    where mandate_reference = 'MANDATE-A-1'$$,
  '23514',
  'Invalid mandate status transition.',
  'An approved mandate cannot transition back to pending'
);
select lives_ok(
  $$update public.mandates set mandate_status = 'RELEASED'
    where mandate_reference = 'MANDATE-A-1'$$,
  'An approved mandate can be manually released'
);
select ok(
  (select released_at is not null from public.mandates where mandate_reference = 'MANDATE-A-1'),
  'Released status records a release timestamp'
);
select throws_ok(
  $$insert into public.allotments (
      user_id, application_id, allotment_status, allotted_lots, allotted_shares,
      allotment_price, refund_amount
    ) values (
      '12121212-1212-4121-8121-121212121212',
      (select id from public.applications where quota_calculation_id = '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a'),
      'ALLOTTED', 3, 30, 10, 0
    )$$,
  '23514',
  'Allotment values exceed the original application or issue terms.',
  'Allotments cannot exceed the saved application quantity'
);
select lives_ok(
  $$insert into public.allotments (
      user_id, application_id, allotment_status, allotted_lots, allotted_shares,
      allotment_price, refund_amount, allotment_date
    ) values (
      '12121212-1212-4121-8121-121212121212',
      (select id from public.applications where quota_calculation_id = '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a'),
      'PARTIAL_ALLOTMENT', 1, 10, 10, 100, '2026-11-05'
    )$$,
  'User A records a valid partial allotment and expected refund'
);
select is(
  (select allotment_status from public.allotments),
  'PARTIAL_ALLOTMENT',
  'Partial allotment is persisted'
);
select lives_ok(
  $$insert into public.capital_ledger (
      user_id, application_id, transaction_type, amount, currency, effective_at,
      source, audit_reference, idempotency_key
    ) values (
      '12121212-1212-4121-8121-121212121212',
      (select application_id from public.allotments),
      'CAPITAL_BLOCKED', 200, 'INR', '2026-11-01T10:00:00Z',
      'MANUAL', 'BLOCK-A-1', 'block-a-1'
    )$$,
  'User A records blocked capital separately'
);
select lives_ok(
  $$insert into public.capital_ledger (
      user_id, application_id, transaction_type, amount, currency, effective_at,
      source, audit_reference, idempotency_key
    ) values (
      '12121212-1212-4121-8121-121212121212',
      (select application_id from public.allotments),
      'ACTUAL_DEBIT', 200, 'INR', '2026-11-02T10:00:00Z',
      'MANUAL', 'DEBIT-A-1', 'debit-a-1'
    )$$,
  'User A records an actual debit which consumes the block once'
);
select is(
  (select blocked_consumed from public.capital_ledger where idempotency_key = 'debit-a-1'),
  200::numeric,
  'Actual debit stores its blocked-capital consumption'
);
select lives_ok(
  $$insert into public.capital_ledger (
      user_id, application_id, transaction_type, amount, currency, effective_at,
      source, audit_reference, idempotency_key
    ) values (
      '12121212-1212-4121-8121-121212121212',
      (select application_id from public.allotments),
      'REFUND_RECEIVED', 100, 'INR', '2026-11-06T10:00:00Z',
      'MANUAL', 'REFUND-A-1', 'refund-a-1'
    )$$,
  'A refund receipt is accepted only within actual debit and expected refund limits'
);
select is(
  (select refund_status from public.allotments),
  'COMPLETED',
  'Refund status completes from the received ledger amount'
);
select lives_ok(
  $$update public.allotments set allotment_date = '2026-11-06'$$,
  'User A can update the allotment date'
);
select is(
  (select count(*) from public.allotment_history),
  2::bigint,
  'Refund status and allotment updates store before/after history rows'
);
select throws_ok(
  $$insert into public.capital_ledger (
      user_id, application_id, transaction_type, amount, currency, effective_at,
      source, audit_reference, idempotency_key
    ) values (
      '12121212-1212-4121-8121-121212121212',
      (select application_id from public.allotments),
      'CAPITAL_BLOCKED', 200, 'INR', '2026-11-01T10:00:00Z',
      'MANUAL', 'BLOCK-A-1', 'block-a-replay'
    )$$,
  '23505',
  'duplicate key value violates unique constraint "capital_ledger_audit_event_unique"',
  'Duplicate financial events are rejected instead of silently appended'
);
select is(
  (select count(*) from public.applications where id = 'abababab-abab-4bab-8bab-abababababab'),
  0::bigint,
  'User A cannot read User B application'
);
select is(
  (select count(*) from public.mandates where application_id = 'abababab-abab-4bab-8bab-abababababab'),
  0::bigint,
  'User A cannot read a mandate belonging to User B'
);
select is(
  (select count(*) from public.allotments where application_id = 'abababab-abab-4bab-8bab-abababababab'),
  0::bigint,
  'User A cannot read User B allotments'
);
select is(
  (select count(*) from public.capital_ledger where user_id = '23232323-2323-4232-8232-232323232323'),
  0::bigint,
  'User A cannot read User B ledger events'
);
select is(
  (select count(*) from public.allotment_history),
  2::bigint,
  'User A reads their allotment history'
);
select throws_ok(
  $$insert into public.mandates (
      user_id, application_id, mandate_reference, mandate_amount
    ) values (
      '12121212-1212-4121-8121-121212121212',
      (select id from public.applications where quota_calculation_id = 'abababab-abab-4bab-8bab-abababababab'),
      'FORGED-APPLICATION', 200
    )$$,
  '23503',
  'insert or update on table "mandates" violates foreign key constraint "mandates_owner_application_fk"',
  'User A cannot bind a mandate to User B application'
);
select throws_ok(
  $$delete from public.capital_ledger where idempotency_key = 'debit-a-1'$$,
  '42501',
  'permission denied for table capital_ledger',
  'Authenticated users cannot delete ledger history'
);
select throws_ok(
  $$update public.mandates set user_id = '23232323-2323-4232-8232-232323232323'
    where mandate_reference = 'MANDATE-A-1'$$,
  '42501',
  'permission denied for table mandates',
  'Authenticated users cannot change mandate ownership'
);

select set_config('request.jwt.claim.sub', '23232323-2323-4232-8232-232323232323', true);
select lives_ok(
  $$insert into public.applications (
      user_id, ipo_id, demat_account_id, category_configuration_id, quota_calculation_id,
      category, rule_version, lot_size, issue_price_min, issue_price_max, cut_off_price,
      lots, shares, price_type, price, application_amount
    ) values (
      '23232323-2323-4232-8232-232323232323',
      '45454545-4545-4454-8454-454545454545',
      '89898989-8989-4898-8989-898989898989',
      '67676767-6767-4676-8676-676767676767',
      'abababab-abab-4bab-8bab-abababababab',
      'RETAIL', 1, 10, 10, 20, null, 2, 20, 'BID', 10, 200
    )$$,
  'User B can record their own eligible application'
);
select is((select count(*) from public.applications), 1::bigint, 'User B reads only their application');
select is(
  (select count(*) from public.applications where id = '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a'),
  0::bigint,
  'User B cannot read User A application'
);
select is((select count(*) from public.mandates), 0::bigint, 'User B cannot read User A mandate');
select is((select count(*) from public.allotments), 0::bigint, 'User B cannot read User A allotment');
select is(
  (select count(*) from public.allotment_history),
  0::bigint,
  'User B cannot read User A allotment history'
);
select is(
  (select count(*) from public.capital_ledger where application_id = '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a'),
  0::bigint,
  'User B cannot read User A ledger events'
);

select * from finish();
rollback;
