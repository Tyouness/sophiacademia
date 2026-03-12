-- Introduce the planned_sessions table.
-- This table becomes the new source of truth for per-session planning,
-- replacing the weekly_schedule jsonb stored in requests.
-- Transition is progressive: requests.weekly_schedule remains intact
-- during the migration period (dual-write from the API).

create table if not exists public.planned_sessions (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.requests(id) on delete cascade,
  scheduled_at   timestamptz not null,
  duration_hours numeric not null check (duration_hours > 0 and duration_hours <= 12),
  status         text not null default 'scheduled'
                   check (status in ('scheduled', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Indexes.
create index if not exists planned_sessions_request_id_idx
  on public.planned_sessions (request_id);

create index if not exists planned_sessions_scheduled_at_idx
  on public.planned_sessions (scheduled_at);

-- Keep updated_at current on every update.
create or replace function public.set_planned_sessions_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_planned_sessions_updated_at on public.planned_sessions;
create trigger set_planned_sessions_updated_at
  before update on public.planned_sessions
  for each row
  execute function public.set_planned_sessions_updated_at();

-- Row-level security.
alter table public.planned_sessions enable row level security;

-- Admins: full access.
drop policy if exists "planned_sessions_admin_all" on public.planned_sessions;
create policy "planned_sessions_admin_all"
  on public.planned_sessions
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Staff: read-only.
drop policy if exists "planned_sessions_staff_read" on public.planned_sessions;
create policy "planned_sessions_staff_read"
  on public.planned_sessions
  for select
  using (public.is_staff());

-- Professor: full access on their own planned sessions (via request ownership).
drop policy if exists "planned_sessions_professor_all" on public.planned_sessions;
create policy "planned_sessions_professor_all"
  on public.planned_sessions
  for all
  using (
    exists (
      select 1
      from public.requests r
      where r.id = planned_sessions.request_id
        and r.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.requests r
      where r.id = planned_sessions.request_id
        and r.professor_id = auth.uid()
    )
  );
