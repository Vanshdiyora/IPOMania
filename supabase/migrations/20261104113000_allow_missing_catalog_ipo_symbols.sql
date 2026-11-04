-- A shared catalog issue can have a published price band and lot size before its exchange symbol.
-- Preserve that absence on caller-owned snapshots instead of inventing a symbol during import.
alter table public.ipos
  alter column symbol drop not null;
