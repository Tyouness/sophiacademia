-- Local billing (no URSSAF dependency): invoices/payslips with line items and legal numbering.

-- Keep existing sequences but ensure they exist.
create sequence if not exists public.invoice_seq;
create sequence if not exists public.payslip_seq;

alter table public.invoices
  add column if not exists issue_date timestamp with time zone,
  add column if not exists period_start timestamp with time zone,
  add column if not exists period_end timestamp with time zone,
  add column if not exists total_ttc numeric,
  add column if not exists status text not null default 'draft';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_status_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_status_check
      check (status in ('draft', 'issued', 'paid', 'cancelled'));
  end if;
end;
$$;

create unique index if not exists invoices_number_unique_idx on public.invoices (number);
create index if not exists invoices_issue_date_idx on public.invoices (issue_date);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  description text not null,
  quantity numeric not null,
  unit_price numeric not null,
  total numeric not null,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists invoice_lines_course_unique_idx on public.invoice_lines (course_id);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

alter table public.payslips
  add column if not exists period_start timestamp with time zone,
  add column if not exists period_end timestamp with time zone,
  add column if not exists total_net numeric not null default 0,
  add column if not exists total_indemn_km numeric not null default 0,
  add column if not exists status text not null default 'pending',
  add column if not exists updated_at timestamp with time zone not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payslips_status_check'
      and conrelid = 'public.payslips'::regclass
  ) then
    alter table public.payslips
      add constraint payslips_status_check
      check (status in ('pending', 'paid'));
  end if;
end;
$$;

create unique index if not exists payslips_number_unique_idx on public.payslips (number);
create unique index if not exists payslips_professor_period_unique_idx on public.payslips (professor_id, period);

create table if not exists public.payslip_lines (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references public.payslips(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  hours numeric not null,
  net_amount numeric not null,
  indemn_km numeric not null,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists payslip_lines_course_unique_idx on public.payslip_lines (course_id);
create index if not exists payslip_lines_payslip_idx on public.payslip_lines (payslip_id);

alter table public.invoice_lines enable row level security;
alter table public.payslip_lines enable row level security;

drop policy if exists "invoice_lines_admin_all" on public.invoice_lines;
drop policy if exists "invoice_lines_family_read" on public.invoice_lines;
create policy "invoice_lines_admin_all"
  on public.invoice_lines
  for all
  using (public.is_staff())
  with check (public.is_staff());
create policy "invoice_lines_family_read"
  on public.invoice_lines
  for select
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and i.family_id = auth.uid()
    )
  );

drop policy if exists "payslip_lines_admin_all" on public.payslip_lines;
drop policy if exists "payslip_lines_professor_read" on public.payslip_lines;
create policy "payslip_lines_admin_all"
  on public.payslip_lines
  for all
  using (public.is_staff())
  with check (public.is_staff());
create policy "payslip_lines_professor_read"
  on public.payslip_lines
  for select
  using (
    exists (
      select 1
      from public.payslips p
      where p.id = payslip_id
        and p.professor_id = auth.uid()
    )
  );
