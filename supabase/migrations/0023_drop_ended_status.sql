-- Phase 4A: Remove the unused 'ended' status value from requests_status_check.
--
-- 'ended' was defined in migration 0002 as a planned status for natural end-of-relationship,
-- but no route has ever written status = 'ended'. The active end-of-relationship action
-- is 'detach' (status = 'detached'), which also writes ended_at / end_reason.
--
-- NOTE: ended_at and end_reason COLUMNS are NOT removed — they are actively used
-- by the detach flow and displayed in the admin UI.
--
-- Only the status VALUE 'ended' is removed here.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'requests_status_check'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests drop constraint requests_status_check;
  end if;
end;
$$;

alter table public.requests
  add constraint requests_status_check
  check (status in ('pending', 'coords_sent', 'approved', 'rejected', 'detached'));
