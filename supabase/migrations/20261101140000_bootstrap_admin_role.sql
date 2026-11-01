update public.profiles
set role = case
  when lower(coalesce(users.email, '')) = 'admin@gmail.com' then 'ADMIN'
  else 'USER'
end,
updated_at = now()
from auth.users as users
where public.profiles.id = users.id;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(left(new.raw_user_meta_data ->> 'full_name', 120), ''),
    case when lower(coalesce(new.email, '')) = 'admin@gmail.com' then 'ADMIN' else 'USER' end
  );
  insert into public.user_preferences (user_id)
  values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
