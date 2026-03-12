-- Course declaration approval flow and pricing snapshot.

alter table public.courses
  add column if not exists approval_status text not null default 'family_pending',
  add column if not exists family_response_deadline timestamp with time zone,
  add column if not exists family_confirmed_at timestamp with time zone,
  add column if not exists family_update_requested_at timestamp with time zone,
  add column if not exists family_update_note text,
  add column if not exists staff_canceled_at timestamp with time zone,
  add column if not exists staff_canceled_by uuid,
  add column if not exists staff_correction_note text,
  add column if not exists staff_corrected_at timestamp with time zone,
  add column if not exists staff_corrected_by uuid,
  add column if not exists distance_km numeric,
  add column if not exists prof_hourly numeric,
  add column if not exists prof_total numeric,
  add column if not exists prof_net numeric,
  add column if not exists indemn_km numeric;

-- Ensure approval status values are valid.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_approval_status_check'
      and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses
      add constraint courses_approval_status_check
      check (approval_status in ('family_pending', 'family_confirmed', 'family_update_requested', 'staff_canceled'));
  end if;
end;
$$;

create index if not exists courses_approval_status_idx on public.courses (approval_status);
