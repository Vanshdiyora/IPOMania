alter table public.applications
  add column category_code text;

update public.applications as application
set category_code = category.category
from public.ipo_categories as category
where category.id = application.category_id
  and category.ipo_id = application.ipo_id
  and category.user_id = application.user_id;

alter table public.applications
  alter column category_id drop not null,
  alter column rule_version drop not null,
  alter column category_code set not null,
  add constraint applications_category_code_check
    check (category_code in ('RETAIL', 'SHNI', 'BHNI', 'SHAREHOLDER', 'EMPLOYER'));

create function public.set_application_category_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null then
    select category
    into new.category_code
    from public.ipo_categories
    where id = new.category_id
      and ipo_id = new.ipo_id
      and user_id = new.user_id;
  elsif new.category_code is null then
    new.category_code := new.calculation_snapshot #>> '{calculation_input,category}';
  end if;
  return new;
end;
$$;

revoke all on function public.set_application_category_code() from public, anon, authenticated;

create trigger applications_set_category_code
  before insert or update of category_id, ipo_id, user_id
  on public.applications
  for each row execute function public.set_application_category_code();

grant insert (
  user_id, ipo_id, demat_account_id, category_id, category_code, lots, total_shares,
  application_amount, application_number, external_reference, submission_date,
  application_status, mandate_status, allotment_status, notes, rule_version,
  calculation_snapshot
) on public.applications to authenticated;
