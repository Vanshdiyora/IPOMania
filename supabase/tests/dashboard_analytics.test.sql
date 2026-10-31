begin;

select plan(11);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'dashboard-user-a@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dashboard User A"}',
    now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'dashboard-user-b@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dashboard User B"}',
    now(), now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'dashboard-user-empty@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dashboard User Empty"}',
    now(), now()
  ),
  (
    '12121212-1212-4121-8121-121212121212',
    'authenticated', 'authenticated', 'dashboard-user-large@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dashboard User Large"}',
    now(), now()
  );

insert into public.ipos (
  id, user_id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
  lot_size, issue_size, opening_date, closing_date, status
)
values
  (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'Dashboard IPO A', 'DASHA', 'Test', 'Test Exchange', 10, 20, 10, 100000,
    current_date + 1, current_date + 3, 'UPCOMING'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',
    'Dashboard IPO B', 'DASHB', 'Test', 'Test Exchange', 10, 20, 10, 100000,
    current_date + 1, current_date + 3, 'UPCOMING'
  ),
  (
    '13131313-1313-4131-8131-131313131313',
    '12121212-1212-4121-8121-121212121212',
    'Dashboard IPO Large', 'DASHL', 'Test', 'Test Exchange', 10, 20, 10, 100000,
    current_date + 1, current_date + 3, 'UPCOMING'
  );

insert into public.ipo_categories (
  id, user_id, ipo_id, category, lot_limit_status, minimum_lots, maximum_lots,
  lot_increment, investment_limit_status, eligibility_conditions, allowed_price_types, rule_source
)
values
  (
    '66666666-6666-4666-8666-666666666666',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    'RETAIL', 'CONFIGURED', 1, 2, 1, 'NO_PUBLISHED_LIMIT', '[]', array['BID'], 'MANUAL'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '22222222-2222-4222-8222-222222222222',
    '55555555-5555-4555-8555-555555555555',
    'RETAIL', 'CONFIGURED', 1, 2, 1, 'NO_PUBLISHED_LIMIT', '[]', array['BID'], 'MANUAL'
  ),
  (
    '14141414-1414-4141-8141-141414141414',
    '12121212-1212-4121-8121-121212121212',
    '13131313-1313-4131-8131-131313131313',
    'RETAIL', 'CONFIGURED', 1, 2, 1, 'NO_PUBLISHED_LIMIT', '[]', array['BID'], 'MANUAL'
  );

insert into public.demat_accounts (
  id, user_id, holder_name, broker_name, depository_type, masked_demat_identifier
)
values
  (
    '88888888-8888-4888-8888-888888888888',
    '11111111-1111-4111-8111-111111111111',
    'Dashboard Holder A', 'Dashboard Broker', 'NSDL', 'XXXXDASHA'
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    '22222222-2222-4222-8222-222222222222',
    'Dashboard Holder B', 'Dashboard Broker', 'NSDL', 'XXXXDASHB'
  ),
  (
    '15151515-1515-4151-8151-151515151515',
    '12121212-1212-4121-8121-121212121212',
    'Dashboard Holder Large', 'Dashboard Broker', 'NSDL', 'XXXXDASHL'
  );

insert into public.applications (
  id, user_id, ipo_id, demat_account_id, category_id, lots, total_shares, application_amount,
  application_status, rule_version, calculation_snapshot, created_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    '88888888-8888-4888-8888-888888888888',
    '66666666-6666-4666-8666-666666666666',
    1, 10, 123456789012345.123456, 'SUBMITTED', 1, '{}',
    (current_date::timestamp + time '12:00') at time zone 'UTC'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    '55555555-5555-4555-8555-555555555555',
    '99999999-9999-4999-8999-999999999999',
    '77777777-7777-4777-8777-777777777777',
    1, 10, 900, 'DRAFT', 1, '{}',
    (current_date::timestamp + time '12:00') at time zone 'UTC'
  );

insert into public.applications (
  user_id, ipo_id, demat_account_id, category_id, lots, total_shares, application_amount,
  application_status, rule_version, calculation_snapshot, created_at
)
select
  '12121212-1212-4121-8121-121212121212',
  '13131313-1313-4131-8131-131313131313',
  '15151515-1515-4151-8151-151515151515',
  '14141414-1414-4141-8141-141414141414',
  1, 10, 100.000001,
  case when generated.number % 2 = 0 then 'DRAFT' else 'SUBMITTED' end,
  1, '{}',
  now() - (generated.number % 365) * interval '1 day'
from generate_series(1, 5000) as generated(number);

insert into public.capital_ledger (
  user_id, application_id, transaction_type, amount, currency, effective_at,
  source, audit_reference, idempotency_key
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'CAPITAL_BLOCKED', 123456789012345.123455, 'INR', now(),
    'MANUAL', 'dashboard precision block 1', 'dashboard-precision-block-1'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'CAPITAL_BLOCKED', 0.000001, 'INR', now(),
    'MANUAL', 'dashboard precision block 2', 'dashboard-precision-block-2'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  public.get_dashboard_analytics()->'totals'->>'applications',
  '1',
  'The dashboard aggregates only User A applications'
);
select is(
  public.get_dashboard_analytics()->'totals'->>'active_demat_accounts',
  '1',
  'The dashboard reports the caller active demat accounts'
);
select is(
  (
    select value->>'capital_blocked'
    from jsonb_array_elements(public.get_dashboard_analytics()->'capital_event_totals') as rows(value)
    where value->>'currency' = 'INR'
  ),
  '123456789012345.123456',
  'Capital analytics preserve PostgreSQL numeric precision'
);
select is(
  public.get_dashboard_analytics(
    p_date_from => current_date,
    p_date_to => current_date
  )->'totals'->>'applications',
  '1',
  'Date filters include both calendar-day boundaries'
);
select is(
  public.get_dashboard_analytics(p_ipo_id => '55555555-5555-4555-8555-555555555555')
    ->'totals'->>'applications',
  '0',
  'An IPO filter cannot reveal another user application'
);
select is(
  public.get_dashboard_analytics()->'upcoming_ipos'->0->>'ipo_id',
  '44444444-4444-4444-8444-444444444444',
  'Upcoming IPO results contain the callers owned record'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  public.get_dashboard_analytics()->'totals'->>'applications',
  '1',
  'User B receives their own independent dashboard totals'
);

select set_config('request.jwt.claim.sub', '12121212-1212-4121-8121-121212121212', true);
select is(
  public.get_dashboard_analytics()->'totals'->>'applications',
  '5000',
  'The database aggregates a large application dataset without a paginated client scan'
);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is(
  public.get_dashboard_analytics()->'totals'->>'applications',
  '0',
  'An empty user receives empty application analytics'
);
select is(
  public.get_dashboard_analytics()->'allotment_performance'->>'success_rate_percent',
  null,
  'An unavailable allotment rate remains null rather than zero'
);
select throws_ok(
  $$select public.get_dashboard_analytics(
      p_date_from => current_date,
      p_date_to => current_date - 1
    )$$,
  '22023',
  'date_from must not be after date_to',
  'The database rejects an inverted date range'
);

select * from finish();
rollback;
