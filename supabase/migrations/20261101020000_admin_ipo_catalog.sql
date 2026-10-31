alter table public.profiles
  add column if not exists role text not null default 'USER'
  check (role in ('USER', 'ADMIN'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create policy "Admins can read profiles for administration"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "Admins can update profiles for administration"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table public.ipo_catalog (
  id uuid primary key default gen_random_uuid(),
  provider_id text unique,
  slug text unique,
  company_name text not null check (char_length(btrim(company_name)) between 1 and 160),
  display_name text,
  symbol text,
  isin text,
  company_logo_url text,
  issue_type text not null default 'mainboard' check (issue_type in ('mainboard', 'SME')),
  ipo_status text not null default 'upcoming' check (ipo_status in ('upcoming', 'open', 'closed', 'listed')),
  industry text,
  exchange text default 'NSE',
  issue_size numeric(24, 4) check (issue_size is null or issue_size > 0),
  fresh_issue_size numeric(24, 4),
  offer_for_sale_size numeric(24, 4),
  face_value numeric(18, 6),
  price_band_min numeric(18, 6),
  price_band_max numeric(18, 6),
  issue_price numeric(18, 6),
  lot_size integer check (lot_size is null or lot_size > 0),
  minimum_quantity integer check (minimum_quantity is null or minimum_quantity > 0),
  minimum_investment numeric(18, 2),
  bidding_start_date date,
  bidding_end_date date,
  allotment_date date,
  refund_date date,
  demat_credit_date date,
  listing_date date,
  listing_exchange text,
  listing_price numeric(18, 6),
  listing_gain_amount numeric(18, 6),
  listing_gain_percentage numeric(12, 4),
  registrar_name text,
  registrar_website text,
  registrar_email text,
  registrar_contact text,
  drhp_url text,
  rhp_url text,
  total_subscription numeric(18, 4),
  qib_subscription numeric(18, 4),
  nii_subscription numeric(18, 4),
  retail_subscription numeric(18, 4),
  subscription_as_of timestamptz,
  data_source text not null default 'MANUAL',
  source_last_updated_at timestamptz,
  last_synced_at timestamptz,
  manual_override_fields text[] not null default '{}'::text[],
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ipo_catalog_status_idx on public.ipo_catalog (ipo_status, bidding_start_date) where archived_at is null;
create index ipo_catalog_listing_idx on public.ipo_catalog (listing_date desc) where archived_at is null;
create index ipo_catalog_company_trgm_idx on public.ipo_catalog using gin (company_name extensions.gin_trgm_ops);

alter table public.ipo_catalog enable row level security;
alter table public.ipo_catalog force row level security;

create policy "Public can read active IPO catalog"
  on public.ipo_catalog for select to anon, authenticated
  using (archived_at is null);
create policy "Admins manage IPO catalog"
  on public.ipo_catalog for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.ipo_catalog from anon, authenticated;
grant select on public.ipo_catalog to anon, authenticated;
grant insert, update, delete on public.ipo_catalog to authenticated;

create trigger ipo_catalog_set_updated_at
  before update on public.ipo_catalog for each row execute function public.set_updated_at();

create table public.ipo_sync_logs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('scheduled', 'manual')),
  provider text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  records_fetched integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_skipped integer not null default 0,
  records_failed integer not null default 0,
  error_message text,
  execution_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index ipo_sync_logs_started_idx on public.ipo_sync_logs (started_at desc);
alter table public.ipo_sync_logs enable row level security;
alter table public.ipo_sync_logs force row level security;
create policy "Admins manage sync logs" on public.ipo_sync_logs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.ipo_sync_logs from anon, authenticated;
grant select, insert, update on public.ipo_sync_logs to authenticated;

create table public.ipo_data_history (
  id uuid primary key default gen_random_uuid(),
  ipo_id uuid not null references public.ipo_catalog(id) on delete restrict,
  field_name text not null,
  previous_value text,
  new_value text,
  source text not null default 'provider',
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create index ipo_data_history_ipo_idx on public.ipo_data_history (ipo_id, changed_at desc);
alter table public.ipo_data_history enable row level security;
alter table public.ipo_data_history force row level security;
create policy "Admins manage data history" on public.ipo_data_history for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.ipo_data_history from anon, authenticated;
grant select, insert on public.ipo_data_history to authenticated;

create table public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.admin_settings enable row level security;
alter table public.admin_settings force row level security;
create policy "Admins manage settings" on public.admin_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.admin_settings from anon, authenticated;
grant select, insert, update on public.admin_settings to authenticated;

create trigger admin_settings_set_updated_at
  before update on public.admin_settings for each row execute function public.set_updated_at();

insert into public.admin_settings (setting_key, setting_value) values
  ('sync_schedule', '{"enabled":true,"cron":"30 3 * * *","timezone":"Asia/Kolkata","scheduledTime":"09:00"}'::jsonb),
  ('sync_limits', '{"manualRunsPerDay":1,"totalRunsPerDay":2}'::jsonb),
  ('data_attribution', '{"upstox":"Upstox","iposMarkets":"ipos.markets"}'::jsonb)
on conflict (setting_key) do nothing;
