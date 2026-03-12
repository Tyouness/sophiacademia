-- Allow family members to confirm or request changes on course declarations.

drop policy if exists "courses_family_update" on public.courses;
create policy "courses_family_update"
  on public.courses
  for update
  using (
    family_id = auth.uid()
    and approval_status in ('family_pending', 'family_confirmed', 'family_update_requested')
  )
  with check (
    family_id = auth.uid()
    and approval_status in ('family_pending', 'family_confirmed', 'family_update_requested')
  );

-- Tighten course updates by role: staff can change status fields; family can change approval fields.

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
