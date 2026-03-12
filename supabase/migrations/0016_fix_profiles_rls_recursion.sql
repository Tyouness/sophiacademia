-- ============================================================
-- 0016_fix_profiles_rls_recursion.sql
-- Corrige la récursion infinie dans profiles_staff_admin_select
-- ============================================================
-- Problème : la policy profiles_staff_admin_select fait un SELECT
-- sur `profiles` depuis une policy sur `profiles` → récursion infinie
-- → PostgreSQL lève une erreur → client JS reçoit profile = null.
--
-- Solution : une fonction SECURITY DEFINER qui s'exécute en tant que
-- son propriétaire (superuser), bypasse le RLS, et peut donc lire
-- profiles sans déclencher les policies.
-- ============================================================

-- ── Fonction helper : vérifier si l'utilisateur courant est staff/admin ──

create or replace function public.is_staff_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles AS p
    where p.id = auth.uid()
      and p.role in ('admin', 'staff')
  );
$$;

-- Accessible aux utilisateurs authentifiés
grant execute on function public.is_staff_or_admin() to authenticated;

-- ── Réécrire la policy récursive ────────────────────────────────

drop policy if exists "profiles_staff_admin_select" on profiles;

create policy "profiles_staff_admin_select"
  on profiles for select
  using (public.is_staff_or_admin());

-- ── Même correction pour les autres tables qui avaient le même pattern ──

-- courses
drop policy if exists "courses_staff_admin_all" on courses;
create policy "courses_staff_admin_all"
  on courses for all
  using (public.is_staff_or_admin());

-- invoices
drop policy if exists "invoices_staff_admin_all" on invoices;
create policy "invoices_staff_admin_all"
  on invoices for all
  using (public.is_staff_or_admin());

-- payslips
drop policy if exists "payslips_staff_admin_all" on payslips;
create policy "payslips_staff_admin_all"
  on payslips for all
  using (public.is_staff_or_admin());

-- requests
drop policy if exists "requests_staff_admin_all" on requests;
create policy "requests_staff_admin_all"
  on requests for all
  using (public.is_staff_or_admin());

-- ── Même correction pour courses/invoices/payslips/requests (rôles familles/profs) ──
-- Ces policies font aussi un exists(select from profiles) → même risque.
-- On remplace par des fonctions dédiées.

create or replace function public.is_family()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles AS p
    where p.id = auth.uid()
      and p.role = 'family'
  );
$$;

create or replace function public.is_professor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles AS p
    where p.id = auth.uid()
      and p.role = 'professor'
  );
$$;

grant execute on function public.is_family() to authenticated;
grant execute on function public.is_professor() to authenticated;

-- courses : réécriture
drop policy if exists "courses_family_select" on courses;
drop policy if exists "courses_professor_select" on courses;

create policy "courses_family_select"
  on courses for select
  using (public.is_family() and family_id = auth.uid());

create policy "courses_professor_select"
  on courses for select
  using (public.is_professor() and professor_id = auth.uid());

-- invoices : réécriture
drop policy if exists "invoices_family_select" on invoices;

create policy "invoices_family_select"
  on invoices for select
  using (public.is_family() and family_id = auth.uid());

-- payslips : réécriture
drop policy if exists "payslips_professor_select" on payslips;

create policy "payslips_professor_select"
  on payslips for select
  using (public.is_professor() and professor_id = auth.uid());

-- requests : réécriture
drop policy if exists "requests_family_select" on requests;
drop policy if exists "requests_professor_select" on requests;

create policy "requests_family_select"
  on requests for select
  using (public.is_family() and family_id = auth.uid());

create policy "requests_professor_select"
  on requests for select
  using (public.is_professor() and professor_id = auth.uid());
