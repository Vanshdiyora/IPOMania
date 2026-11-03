begin;

select plan(5);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '60606060-6060-4060-8060-606060606060',
    'authenticated', 'authenticated', 'admin@gmail.com', '',
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '70707070-7070-4070-8070-707070707070',
    'authenticated', 'authenticated', 'catalog-viewer@example.test', '',
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

insert into public.ipo_catalog (id, provider_id, company_name, ipo_status)
values (
  '80808080-8080-4080-8080-808080808080',
  'catalog-category-policy-test',
  'Catalog category policy test',
  'open'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.ipo_catalog_categories'::regclass),
  true,
  'Shared IPO category rules enable RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.ipo_catalog_categories'::regclass),
  true,
  'Shared IPO category rules force RLS'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '60606060-6060-4060-8060-606060606060', true);
insert into public.ipo_catalog_categories (
  ipo_catalog_id, category, lot_limit_status, lot_increment,
  investment_limit_status, allowed_price_types, source_reference, rule_source
)
values (
  '80808080-8080-4080-8080-808080808080',
  'RETAIL',
  'UNCONFIGURED',
  1,
  'UNCONFIGURED',
  array['BID'],
  'https://issuer.example/rules',
  'PUBLISHED_SOURCE'
);
select is(
  (select rule_version from public.ipo_catalog_categories
   where ipo_catalog_id = '80808080-8080-4080-8080-808080808080'
     and category = 'RETAIL'),
  1,
  'Admins create shared category rules with database-assigned versions'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '70707070-7070-4070-8070-707070707070', true);
select is(
  (select count(*) from public.ipo_catalog_categories
   where ipo_catalog_id = '80808080-8080-4080-8080-808080808080'),
  1::bigint,
  'Signed-in users can read active shared category rules'
);
select throws_ok(
  $$insert into public.ipo_catalog_categories (
    ipo_catalog_id, category, lot_limit_status, lot_increment,
    investment_limit_status, allowed_price_types
  ) values (
    '80808080-8080-4080-8080-808080808080',
    'SHNI',
    'UNCONFIGURED',
    1,
    'UNCONFIGURED',
    array['BID']
  )$$,
  '42501',
  'new row violates row-level security policy for table "ipo_catalog_categories"',
  'Regular users cannot create shared category rules'
);

select * from finish();
rollback;
