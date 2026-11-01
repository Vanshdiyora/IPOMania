create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

grant insert (id, full_name) on public.profiles to authenticated;

insert into public.profiles (id, full_name)
select
  users.id,
  nullif(left(users.raw_user_meta_data ->> 'full_name', 120), '')
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null;

insert into public.user_preferences (user_id)
select users.id
from auth.users as users
left join public.user_preferences as preferences on preferences.user_id = users.id
where preferences.user_id is null;
