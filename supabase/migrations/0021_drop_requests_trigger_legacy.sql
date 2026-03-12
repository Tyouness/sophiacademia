-- Phase 3B: Remove legacy planning column references from enforce_request_status_only.
-- The 4 columns (first_course_at, weekly_sessions, session_hours, weekly_schedule)
-- are being dropped in migration 0022. This trigger must be updated first so that
-- it no longer references those columns.
--
-- Changes vs 0017:
--   is_staff()  block: remove the 4 legacy planning column checks
--   is_professor() block: unchanged (already did not reference the 4 columns)

create or replace function public.enforce_request_status_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if public.is_staff() then
    if new.professor_id is distinct from old.professor_id
      or new.family_id is distinct from old.family_id
      or new.child_id is distinct from old.child_id
      or new.subject is distinct from old.subject
      or new.created_at is distinct from old.created_at
    then
      raise exception 'staff may only update status fields on requests';
    end if;

    return new;
  end if;

  if public.is_professor() then
    if new.status is distinct from old.status
      or new.rejected_at is distinct from old.rejected_at
      or new.ended_at is distinct from old.ended_at
      or new.end_reason is distinct from old.end_reason
      or new.professor_id is distinct from old.professor_id
      or new.family_id is distinct from old.family_id
      or new.child_id is distinct from old.child_id
      or new.subject is distinct from old.subject
      or new.created_at is distinct from old.created_at
    then
      raise exception 'professors may only update status fields on requests';
    end if;

    return new;
  end if;

  return new;
end;
$$;
