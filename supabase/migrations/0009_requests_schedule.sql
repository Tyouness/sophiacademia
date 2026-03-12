-- Add scheduling fields for professor planning.

alter table public.requests
  add column if not exists first_course_at timestamp with time zone;

alter table public.requests
  add column if not exists weekly_sessions integer;

alter table public.requests
  add column if not exists session_hours numeric;

alter table public.requests
  add column if not exists weekly_schedule jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'requests_weekly_sessions_check'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests
      add constraint requests_weekly_sessions_check
      check (weekly_sessions is null or (weekly_sessions >= 1 and weekly_sessions <= 7));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'requests_session_hours_check'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests
      add constraint requests_session_hours_check
      check (session_hours is null or (session_hours >= 0.5 and session_hours <= 6));
  end if;
end;
$$;

-- Allow professors to update schedule fields on their requests.

drop policy if exists "requests_professor_update_schedule" on public.requests;
create policy "requests_professor_update_schedule"
  on public.requests
  for update
  using (
    professor_id = auth.uid()
    and status in ('coords_sent', 'approved')
  )
  with check (
    professor_id = auth.uid()
    and status in ('coords_sent', 'approved')
  );

-- Tighten update rules: staff can only touch status fields; professors can only touch schedule fields.

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
