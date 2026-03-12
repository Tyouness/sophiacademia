-- ============================================================
-- 0015_rls_famille_professeur.sql
-- RLS policies — séparation stricte famille / professeur
-- ============================================================

-- ── Activer RLS sur les tables principales ───────────────────

-- profiles : chaque utilisateur voit uniquement son propre profil
alter table if exists profiles enable row level security;

drop policy if exists "profiles_self_select" on profiles;
drop policy if exists "profiles_self_update" on profiles;

create policy "profiles_self_select"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles_self_update"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Les staff/admin peuvent tout lire dans profiles
drop policy if exists "profiles_staff_admin_select" on profiles;
create policy "profiles_staff_admin_select"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

-- ── courses : famille voit ses propres cours, professeur les siens ──

alter table if exists courses enable row level security;

drop policy if exists "courses_family_select" on courses;
drop policy if exists "courses_professor_select" on courses;
drop policy if exists "courses_staff_admin_all" on courses;

-- Familles : uniquement leurs cours
create policy "courses_family_select"
  on courses for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'family'
    )
    and family_id = auth.uid()
  );

-- Professeurs : uniquement leurs cours
create policy "courses_professor_select"
  on courses for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'professor'
    )
    and professor_id = auth.uid()
  );

-- Staff/Admin : accès complet
create policy "courses_staff_admin_all"
  on courses for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

-- ── invoices : familles voient uniquement leurs factures ────────

alter table if exists invoices enable row level security;

drop policy if exists "invoices_family_select" on invoices;
drop policy if exists "invoices_staff_admin_all" on invoices;

create policy "invoices_family_select"
  on invoices for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'family'
    )
    and family_id = auth.uid()
  );

create policy "invoices_staff_admin_all"
  on invoices for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

-- ── payslips : professeurs voient uniquement les leurs ──────────

alter table if exists payslips enable row level security;

drop policy if exists "payslips_professor_select" on payslips;
drop policy if exists "payslips_staff_admin_all" on payslips;

create policy "payslips_professor_select"
  on payslips for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'professor'
    )
    and professor_id = auth.uid()
  );

create policy "payslips_staff_admin_all"
  on payslips for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

-- ── requests : accès séparé par rôle ────────────────────────────

alter table if exists requests enable row level security;

drop policy if exists "requests_family_select" on requests;
drop policy if exists "requests_professor_select" on requests;
drop policy if exists "requests_staff_admin_all" on requests;

create policy "requests_family_select"
  on requests for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'family'
    )
    and family_id = auth.uid()
  );

create policy "requests_professor_select"
  on requests for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'professor'
    )
    and professor_id = auth.uid()
  );

create policy "requests_staff_admin_all"
  on requests for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );
