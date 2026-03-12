create extension if not exists "pgcrypto";

-- Sequences for invoice and payslip numbers.
create sequence if not exists public.invoice_seq;
create sequence if not exists public.payslip_seq;

create or replace function public.nextval(sequence_name text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  result bigint;
begin
  execute format('select nextval(%L)', sequence_name) into result;
  return result;
end;
$$;

grant execute on function public.nextval(text) to authenticated;

-- Unique payslip per professor/family/period.
create unique index if not exists payslips_professor_family_period_idx
  on public.payslips (professor_id, family_id, period);

-- Tighten RLS for requests and courses.
drop policy if exists "requests_staff_all" on public.requests;
drop policy if exists "courses_staff_all" on public.courses;

drop policy if exists "requests_staff_select" on public.requests;
drop policy if exists "requests_staff_update" on public.requests;
drop policy if exists "courses_staff_select" on public.courses;
drop policy if exists "courses_staff_update" on public.courses;

drop policy if exists "requests_professor_insert" on public.requests;
drop policy if exists "courses_professor_insert" on public.courses;

create policy "requests_staff_select"
  on public.requests
  for select
  using (public.is_staff());

create policy "requests_staff_update"
  on public.requests
  for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "courses_staff_select"
  on public.courses
  for select
  using (public.is_staff());

create policy "courses_staff_update"
  on public.courses
  for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "requests_professor_insert"
  on public.requests
  for insert
  with check (
    professor_id = auth.uid()
    and status = 'pending'
  );

create policy "courses_professor_insert"
  on public.courses
  for insert
  with check (
    professor_id = auth.uid()
    and status = 'pending'
  );

-- Enforce staff updates to status-only fields.
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

  if new.professor_id is distinct from old.professor_id
    or new.family_id is distinct from old.family_id
    or new.subject is distinct from old.subject
    or new.created_at is distinct from old.created_at
  then
    raise exception 'staff may only update status fields on requests';
  end if;

  return new;
end;
$$;

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

  if new.professor_id is distinct from old.professor_id
    or new.family_id is distinct from old.family_id
    or new.subject is distinct from old.subject
    or new.hours is distinct from old.hours
    or new.courses_count is distinct from old.courses_count
    or new.created_at is distinct from old.created_at
  then
    raise exception 'staff may only update status fields on courses';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'requests_status_only_update'
  ) then
    create trigger requests_status_only_update
      before update on public.requests
      for each row execute function public.enforce_request_status_only();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'courses_status_only_update'
  ) then
    create trigger courses_status_only_update
      before update on public.courses
      for each row execute function public.enforce_course_status_only();
  end if;
end;
$$;
