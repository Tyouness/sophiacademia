-- Phase 1: link requests and courses to a specific child.
-- child_id is nullable to preserve all existing records without retroactive assignment.

-- 1. Add child_id to requests ------------------------------------------------

alter table public.requests
  add column if not exists child_id uuid references public.family_children(id) on delete set null;

create index if not exists requests_child_id_idx on public.requests (child_id);

-- Drop the old unique index that did not include child_id.
-- The new index allows one active request per (professor, family, child, subject).
-- Two requests for the same family/subject but different children are now permitted.
drop index if exists requests_unique_pair_idx;

create unique index if not exists requests_unique_pair_idx
  on public.requests (professor_id, family_id, child_id, subject, status)
  where status in ('pending', 'coords_sent', 'approved');

-- 2. Add child_id to courses -------------------------------------------------

alter table public.courses
  add column if not exists child_id uuid references public.family_children(id) on delete set null;

create index if not exists courses_child_id_idx on public.courses (child_id);

-- 3. Update enforce_request_status_only to protect child_id -----------------
-- admin : unrestricted
-- staff : cannot change child_id (immutable once created)
-- professor : cannot change child_id

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
      or new.first_course_at is distinct from old.first_course_at
      or new.weekly_sessions is distinct from old.weekly_sessions
      or new.session_hours is distinct from old.session_hours
      or new.weekly_schedule is distinct from old.weekly_schedule
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
      raise exception 'professors may only update schedule fields on requests';
    end if;

    return new;
  end if;

  return new;
end;
$$;

-- 4. Update enforce_course_status_only to protect child_id ------------------
-- staff : can correct hours/count/familyId/subject/note but NOT child_id
-- family : can only update approval fields, NOT child_id

create or replace function public.enforce_course_status_only()
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
      or new.hours is distinct from old.hours
      or new.courses_count is distinct from old.courses_count
      or new.course_date is distinct from old.course_date
      or new.created_at is distinct from old.created_at
    then
      raise exception 'staff may only update status fields on courses';
    end if;

    return new;
  end if;

  if public.is_family() then
    if new.professor_id is distinct from old.professor_id
      or new.family_id is distinct from old.family_id
      or new.child_id is distinct from old.child_id
      or new.subject is distinct from old.subject
      or new.status is distinct from old.status
      or new.hours is distinct from old.hours
      or new.courses_count is distinct from old.courses_count
      or new.course_date is distinct from old.course_date
      or new.paid_at is distinct from old.paid_at
      or new.created_at is distinct from old.created_at
      or new.distance_km is distinct from old.distance_km
      or new.prof_hourly is distinct from old.prof_hourly
      or new.prof_total is distinct from old.prof_total
      or new.prof_net is distinct from old.prof_net
      or new.indemn_km is distinct from old.indemn_km
      or new.staff_canceled_at is distinct from old.staff_canceled_at
      or new.staff_canceled_by is distinct from old.staff_canceled_by
      or new.staff_correction_note is distinct from old.staff_correction_note
      or new.staff_corrected_at is distinct from old.staff_corrected_at
      or new.staff_corrected_by is distinct from old.staff_corrected_by
    then
      raise exception 'family may only update approval fields on courses';
    end if;

    return new;
  end if;

  return new;
end;
$$;

-- 5. RLS: allow staff to read family_children --------------------------------
-- (already readable by admin via is_admin policy; staff need access for joins)
drop policy if exists "family_children_staff_read" on public.family_children;
create policy "family_children_staff_read"
  on public.family_children
  for select
  using (public.is_staff());

-- 6. Deprecation comments on legacy mono-child columns in family_profiles ----
comment on column public.family_profiles.student_first
  is 'DEPRECATED — use family_children table. Kept for backward compatibility.';
comment on column public.family_profiles.student_last
  is 'DEPRECATED — use family_children table. Kept for backward compatibility.';
comment on column public.family_profiles.level
  is 'DEPRECATED — use family_children.level. Kept for backward compatibility.';
comment on column public.family_profiles.subjects
  is 'DEPRECATED — use family_children.subjects. Kept for backward compatibility.';
