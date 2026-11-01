create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'admin@gmail.com'
    and exists (
      select 1
      from public.profiles
      where id = auth.uid() and role = 'ADMIN'
    );
$$;

revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
