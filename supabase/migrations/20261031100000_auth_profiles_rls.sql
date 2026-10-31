create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_notifications boolean not null default true,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their own preferences"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.user_preferences from anon, authenticated;
grant select on public.profiles, public.user_preferences to authenticated;
grant delete on public.profiles, public.user_preferences to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (email_notifications, timezone) on public.user_preferences to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'full_name', 120), ''));
  insert into public.user_preferences (user_id)
  values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
