-- URSSAF Avance Immediate support.

alter table public.profiles
  add column if not exists birth_date date;

alter table public.family_profiles
  add column if not exists fiscal_consent boolean not null default false,
  add column if not exists mandate_consent boolean not null default false,
  add column if not exists legal_notice_accepted boolean not null default false,
  add column if not exists urssaf_consent_at timestamp with time zone;

alter table public.professor_profiles
  add column if not exists birth_date date,
  add column if not exists employment_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'professor_profiles_employment_status_check'
      and conrelid = 'public.professor_profiles'::regclass
  ) then
    alter table public.professor_profiles
      add constraint professor_profiles_employment_status_check
      check (employment_status is null or employment_status in ('student', 'employee', 'self_employed', 'other'));
  end if;
end;
$$;

create table if not exists public.urssaf_clients (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.profiles(id) on delete cascade,
  urssaf_customer_id text,
  status text not null default 'pending',
  fiscal_number text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists urssaf_clients_family_unique_idx on public.urssaf_clients (family_id);
create index if not exists urssaf_clients_status_idx on public.urssaf_clients (status);

create table if not exists public.course_invoices (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  family_id uuid not null references public.profiles(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  number text,
  amount numeric not null,
  issued_at timestamp with time zone not null default now(),
  sent_at timestamp with time zone,
  status text not null default 'issued',
  created_at timestamp with time zone not null default now()
);

create unique index if not exists course_invoices_course_unique_idx on public.course_invoices (course_id);
create index if not exists course_invoices_family_idx on public.course_invoices (family_id);

create table if not exists public.urssaf_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.course_invoices(id) on delete cascade,
  urssaf_payment_id text,
  status text not null default 'submitted',
  submitted_at timestamp with time zone not null default now(),
  validated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists urssaf_invoices_invoice_unique_idx on public.urssaf_invoices (invoice_id);
create index if not exists urssaf_invoices_status_idx on public.urssaf_invoices (status);

create table if not exists public.monthly_statements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.profiles(id) on delete cascade,
  period text not null,
  total_hours numeric not null,
  total_amount numeric not null,
  number text,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists monthly_statements_family_period_idx on public.monthly_statements (family_id, period);

-- Extend course statuses with URSSAF finalization.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'courses_status_check'
      and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses drop constraint courses_status_check;
  end if;
end;
$$;

alter table public.courses
  add constraint courses_status_check
  check (status in ('pending', 'paid', 'advance', 'paid_by_urssaf'));

-- Add updated_at triggers.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_urssaf_clients_updated_at') then
    create trigger set_urssaf_clients_updated_at
    before update on public.urssaf_clients
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_urssaf_invoices_updated_at') then
    create trigger set_urssaf_invoices_updated_at
    before update on public.urssaf_invoices
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- RLS
alter table public.urssaf_clients enable row level security;
alter table public.course_invoices enable row level security;
alter table public.urssaf_invoices enable row level security;
alter table public.monthly_statements enable row level security;

drop policy if exists "urssaf_clients_admin_all" on public.urssaf_clients;
drop policy if exists "urssaf_clients_family_read" on public.urssaf_clients;
create policy "urssaf_clients_admin_all"
  on public.urssaf_clients
  for all
  using (public.is_staff())
  with check (public.is_staff());
create policy "urssaf_clients_family_read"
  on public.urssaf_clients
  for select
  using (family_id = auth.uid());

drop policy if exists "course_invoices_admin_all" on public.course_invoices;
drop policy if exists "course_invoices_family_read" on public.course_invoices;
drop policy if exists "course_invoices_professor_read" on public.course_invoices;
create policy "course_invoices_admin_all"
  on public.course_invoices
  for all
  using (public.is_staff())
  with check (public.is_staff());
create policy "course_invoices_family_read"
  on public.course_invoices
  for select
  using (family_id = auth.uid());
create policy "course_invoices_professor_read"
  on public.course_invoices
  for select
  using (professor_id = auth.uid());

drop policy if exists "urssaf_invoices_admin_all" on public.urssaf_invoices;
create policy "urssaf_invoices_admin_all"
  on public.urssaf_invoices
  for all
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "monthly_statements_admin_all" on public.monthly_statements;
drop policy if exists "monthly_statements_family_read" on public.monthly_statements;
create policy "monthly_statements_admin_all"
  on public.monthly_statements
  for all
  using (public.is_staff())
  with check (public.is_staff());
create policy "monthly_statements_family_read"
  on public.monthly_statements
  for select
  using (family_id = auth.uid());
