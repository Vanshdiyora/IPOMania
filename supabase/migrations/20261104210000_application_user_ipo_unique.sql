-- Keep only one active application per user per IPO, while preserving older history by archiving duplicates.
with ranked AS (
  select
    id,
    row_number() over (
      partition by user_id, ipo_id
      order by created_at desc, id desc
    ) as row_num
  from public.applications
  where archived_at is null
)
update public.applications app
set
  archived_at = coalesce(app.archived_at, now()),
  updated_at = now()
from ranked
where app.id = ranked.id
  and ranked.row_num > 1;

create unique index if not exists applications_user_ipo_unique
  on public.applications (user_id, ipo_id)
  where archived_at is null;
