begin;

select plan(19);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'rls-user-a@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"User A"}',
    now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'rls-user-b@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"User B"}',
    now(), now()
  );

select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles has row-level security enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles forces row-level security'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.user_preferences'::regclass),
  true,
  'user_preferences has row-level security enabled'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select count(*) from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'User A can read User A profile'
);
select is(
  (select count(*) from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'User A cannot read User B profile'
);
select is(
  (with changed as (
    update public.profiles set full_name = 'User A updated'
    where id = '11111111-1111-4111-8111-111111111111'
    returning 1
  ) select count(*) from changed),
  1::bigint,
  'User A can update User A profile'
);
select is(
  (with changed as (
    update public.profiles set full_name = 'Compromised'
    where id = '22222222-2222-4222-8222-222222222222'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'User A cannot update User B profile'
);
select is(
  (with removed as (
    delete from public.profiles
    where id = '22222222-2222-4222-8222-222222222222'
    returning 1
  ) select count(*) from removed),
  0::bigint,
  'User A cannot delete User B profile'
);
select is(
  (with removed as (
    delete from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
    returning 1
  ) select count(*) from removed),
  0::bigint,
  'Users cannot directly delete their own profile'
);
select is(
  (select count(*) from public.user_preferences where user_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  'User A can read User A preferences'
);
select is(
  (select count(*) from public.user_preferences where user_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'User A cannot read User B preferences'
);
select is(
  (with changed as (
    update public.user_preferences set timezone = 'Europe/London'
    where user_id = '11111111-1111-4111-8111-111111111111'
    returning 1
  ) select count(*) from changed),
  1::bigint,
  'User A can update User A preferences'
);
select is(
  (with changed as (
    update public.user_preferences set timezone = 'Europe/London'
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'User A cannot update User B preferences'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  (select count(*) from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  1::bigint,
  'User B can read User B profile'
);
select is(
  (select count(*) from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'User B cannot read User A profile'
);
select is(
  (select count(*) from public.user_preferences where user_id = '22222222-2222-4222-8222-222222222222'),
  1::bigint,
  'User B can read User B preferences'
);
select is(
  (select count(*) from public.user_preferences where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'User B cannot read User A preferences'
);

reset role;
select is(
  (select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'User A updated',
  'User A update persisted without changing ownership'
);
select is(
  (select count(*) from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  1::bigint,
  'User B profile remains after User A delete attempt'
);

select * from finish();
rollback;
