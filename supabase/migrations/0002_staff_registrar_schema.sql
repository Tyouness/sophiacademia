create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  full_name text,
  role text not null default 'family',
  disabled_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists disabled_at timestamp with time zone;
alter table public.profiles add column if not exists deleted_at timestamp with time zone;
alter table public.profiles add column if not exists created_at timestamp with time zone default now();
alter table public.profiles add column if not exists updated_at timestamp with time zone default now();

-- Convert enum role to text if needed.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.profiles
      alter column role type text
      using role::text;
  end if;
end;
$$;

-- Enforce role values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'staff', 'family', 'professor'));
  end if;
end;
$$;

-- Ensure role is non-null.
alter table public.profiles
  alter column role set not null;

-- updated_at trigger for profiles.
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_profiles_updated_at'
  ) then
    create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

create table if not exists public.family_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  rep_first text,
  rep_last text,
  rep_phone text,
  student_first text,
  student_last text,
  level text,
  subjects jsonb,
  freq text,
  duration numeric,
  start_date date,
  address text,
  city text,
  postcode text,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.professor_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  skills jsonb,
  car_hp integer,
  nir text,
  address text,
  city text,
  postcode text,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.profiles(id) on delete cascade,
  subject text,
  status text not null,
  rejected_at timestamp with time zone,
  ended_at timestamp with time zone,
  end_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.profiles(id) on delete cascade,
  hours numeric not null,
  courses_count integer not null,
  subject text,
  status text not null,
  paid_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.profiles(id) on delete cascade,
  period text not null,
  total numeric not null,
  number text,
  hours numeric,
  pdf_url text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.profiles(id) on delete cascade,
  period text not null,
  number text,
  pdf_url text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

-- Backward-compatible columns for older audit usage.
alter table public.audit_logs add column if not exists target_user_id uuid;
alter table public.audit_logs add column if not exists role_set text;
alter table public.audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Constraints for status values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'requests_status_check'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests
      add constraint requests_status_check
      check (status in ('pending', 'approved', 'rejected', 'ended', 'detached'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_status_check'
      and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses
      add constraint courses_status_check
      check (status in ('pending', 'paid', 'advance'));
  end if;
end;
$$;

-- Indexes.
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists requests_professor_id_idx on public.requests (professor_id);
create index if not exists requests_family_id_idx on public.requests (family_id);
create index if not exists requests_status_idx on public.requests (status);
create unique index if not exists requests_unique_pair_idx
  on public.requests (professor_id, family_id, subject, status)
  where status in ('pending', 'approved');

create index if not exists courses_professor_id_idx on public.courses (professor_id);
create index if not exists courses_family_id_idx on public.courses (family_id);
create index if not exists courses_status_idx on public.courses (status);

create unique index if not exists invoices_family_period_idx on public.invoices (family_id, period);
create index if not exists payslips_professor_id_idx on public.payslips (professor_id);
create index if not exists payslips_family_id_idx on public.payslips (family_id);

-- updated_at triggers.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_family_profiles_updated_at') then
    create trigger set_family_profiles_updated_at
    before update on public.family_profiles
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_professor_profiles_updated_at') then
    create trigger set_professor_profiles_updated_at
    before update on public.professor_profiles
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_requests_updated_at') then
    create trigger set_requests_updated_at
    before update on public.requests
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_courses_updated_at') then
    create trigger set_courses_updated_at
    before update on public.courses
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- Role helpers.
create or replace function public.has_any_role(roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = any(roles)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_any_role(array['admin']);
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_any_role(array['admin', 'staff']);
$$;

create or replace function public.is_family()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_any_role(array['family']);
$$;

create or replace function public.is_professor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_any_role(array['professor']);
$$;

-- RLS enable.
alter table public.profiles enable row level security;
alter table public.family_profiles enable row level security;
alter table public.professor_profiles enable row level security;
alter table public.requests enable row level security;
alter table public.courses enable row level security;
alter table public.invoices enable row level security;
alter table public.payslips enable row level security;
alter table public.audit_logs enable row level security;

-- Drop existing policies to avoid conflicts.
drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_owner_read" on public.profiles;
drop policy if exists "profiles_staff_read" on public.profiles;

drop policy if exists "family_profiles_admin_all" on public.family_profiles;
drop policy if exists "family_profiles_owner_read" on public.family_profiles;
drop policy if exists "family_profiles_owner_write" on public.family_profiles;

drop policy if exists "professor_profiles_admin_all" on public.professor_profiles;
drop policy if exists "professor_profiles_owner_read" on public.professor_profiles;
drop policy if exists "professor_profiles_owner_write" on public.professor_profiles;

drop policy if exists "requests_admin_all" on public.requests;
drop policy if exists "requests_staff_all" on public.requests;
drop policy if exists "requests_family_read" on public.requests;
drop policy if exists "requests_professor_read" on public.requests;

drop policy if exists "courses_admin_all" on public.courses;
drop policy if exists "courses_staff_all" on public.courses;
drop policy if exists "courses_family_read" on public.courses;
drop policy if exists "courses_professor_read" on public.courses;

drop policy if exists "invoices_admin_all" on public.invoices;
drop policy if exists "invoices_staff_read" on public.invoices;
drop policy if exists "invoices_family_read" on public.invoices;

drop policy if exists "payslips_admin_all" on public.payslips;
drop policy if exists "payslips_staff_read" on public.payslips;
drop policy if exists "payslips_professor_read" on public.payslips;

drop policy if exists "audit_admin_all" on public.audit_logs;

-- Profiles policies.
create policy "profiles_admin_all"
  on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_owner_read"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_staff_read"
  on public.profiles
  for select
  using (public.is_staff());

-- Family profiles policies.
create policy "family_profiles_admin_all"
  on public.family_profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "family_profiles_owner_read"
  on public.family_profiles
  for select
  using (auth.uid() = id);

create policy "family_profiles_owner_write"
  on public.family_profiles
  for insert
  with check (auth.uid() = id);

-- Professor profiles policies.
create policy "professor_profiles_admin_all"
  on public.professor_profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "professor_profiles_owner_read"
  on public.professor_profiles
  for select
  using (auth.uid() = id);

create policy "professor_profiles_owner_write"
  on public.professor_profiles
  for insert
  with check (auth.uid() = id);

-- Requests policies.
create policy "requests_admin_all"
  on public.requests
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "requests_staff_all"
  on public.requests
  for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "requests_family_read"
  on public.requests
  for select
  using (family_id = auth.uid());

create policy "requests_professor_read"
  on public.requests
  for select
  using (professor_id = auth.uid());

-- Courses policies.
create policy "courses_admin_all"
  on public.courses
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "courses_staff_all"
  on public.courses
  for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "courses_family_read"
  on public.courses
  for select
  using (family_id = auth.uid());

create policy "courses_professor_read"
  on public.courses
  for select
  using (professor_id = auth.uid());

-- Invoices policies.
create policy "invoices_admin_all"
  on public.invoices
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "invoices_staff_read"
  on public.invoices
  for select
  using (public.is_staff());

create policy "invoices_family_read"
  on public.invoices
  for select
  using (family_id = auth.uid());

-- Payslips policies.
create policy "payslips_admin_all"
  on public.payslips
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "payslips_staff_read"
  on public.payslips
  for select
  using (public.is_staff());

create policy "payslips_professor_read"
  on public.payslips
  for select
  using (professor_id = auth.uid());

-- Audit logs policies.
create policy "audit_admin_all"
  on public.audit_logs
  for all
  using (public.is_admin())
  with check (public.is_admin());
