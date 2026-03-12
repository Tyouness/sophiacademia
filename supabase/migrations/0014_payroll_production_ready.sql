-- Payroll production hardening: distance/IK snapshot, monthly payslips fields, and versioning.

do $$
begin
  if to_regclass('public.courses') is not null then
    alter table public.courses
      add column if not exists distance_km_one_way numeric,
      add column if not exists distance_km_round_trip numeric,
      add column if not exists duration_minutes numeric,
      add column if not exists distance_source text,
      add column if not exists distance_fetched_at timestamp with time zone,
      add column if not exists ik_amount numeric,
      add column if not exists ik_rate_version text,
      add column if not exists pricing_policy_version text,
      add column if not exists rate_set_version text,
      add column if not exists rounding_policy_version text,
      add column if not exists course_month text;

    create index if not exists courses_course_month_idx on public.courses (course_month);
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.payslips') is not null then
    alter table public.payslips
      add column if not exists period text,
      add column if not exists course_ids jsonb,
      add column if not exists rate_set_version text,
      add column if not exists pricing_policy_version text,
      add column if not exists rounding_policy_version text,
      add column if not exists gross_salary_total numeric,
      add column if not exists net_salary_total numeric,
      add column if not exists reimbursements_total numeric,
      add column if not exists employer_contribs_total numeric,
      add column if not exists calculation_hash text,
      add column if not exists pdf_path text;

    alter table public.payslips
      alter column family_id drop not null;

    create unique index if not exists payslips_professor_period_unique_idx on public.payslips (professor_id, period);
  end if;
end;
$$;
