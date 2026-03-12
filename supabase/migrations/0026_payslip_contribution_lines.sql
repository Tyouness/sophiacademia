-- Migration 0026: payslip_contribution_lines — persistance détaillée des cotisations.
--
-- Objectif :
--   Les cotisations calculées par computeCourseBreakdown (7 postes salariales, 11+ patronales)
--   n'étaient jusqu'ici persistées qu'en mémoire via les totaux agrégés sur payslips.
--   Cette table les rend stockées, traçables et exploitables par les documents sociaux.
--
-- Rattachement :
--   Une ligne = un poste de cotisation pour un bulletin maître (payslips).
--   Les documents famille (payslip_family_documents) les lisent via payslip_id et
--   appliquent une proratisation par famille — pas de duplication.
--
-- Idempotence :
--   La contrainte unique (payslip_id, nature, type) garantit qu'un re-run de
--   computeMonthlyPayslip ne duplique pas les lignes (upsert onConflict).

create table if not exists public.payslip_contribution_lines (
  id          uuid primary key default gen_random_uuid(),

  -- Bulletin maître auquel cette cotisation est rattachée
  payslip_id  uuid not null references public.payslips(id) on delete cascade,

  -- Identifiant machine du poste (ex : "retraite_ss_plaf", "maladie_maternite")
  nature      text not null,

  -- Libellé lisible pour affichage dans les documents
  label       text not null,

  -- "salariale" | "patronale"
  type        text not null check (type in ('salariale', 'patronale')),

  -- Base de calcul en EUR (montant brut soumis)
  base        numeric,

  -- Taux appliqué (ex : 0.069 pour 6,9%)
  rate        numeric,

  -- Montant de la cotisation en EUR (positif = débit, négatif = déduction)
  amount      numeric not null,

  -- Version du barème utilisé pour CE calcul (traçabilité)
  rate_set_version text,

  created_at  timestamp with time zone not null default now()
);

-- Un seul enregistrement par poste par bulletin — idempotence lors des re-runs
create unique index if not exists payslip_contribution_lines_unique_idx
  on public.payslip_contribution_lines (payslip_id, nature, type);

-- Index pour accès par bulletin (lecture PDF, audit)
create index if not exists payslip_contribution_lines_payslip_idx
  on public.payslip_contribution_lines (payslip_id);

-- RLS
alter table public.payslip_contribution_lines enable row level security;

drop policy if exists "payslip_contribution_lines_staff_all" on public.payslip_contribution_lines;
create policy "payslip_contribution_lines_staff_all"
  on public.payslip_contribution_lines
  for all
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "payslip_contribution_lines_professor_select" on public.payslip_contribution_lines;
create policy "payslip_contribution_lines_professor_select"
  on public.payslip_contribution_lines
  for select
  using (
    exists (
      select 1
      from public.payslips p
      where p.id = payslip_id
        and p.professor_id = auth.uid()
    )
  );

comment on table public.payslip_contribution_lines is
  'Détail des cotisations sociales par poste pour chaque bulletin mensuel (payslip). '
  '1 ligne = 1 poste (nature + type salariale/patronale). '
  'Idempotent : unique sur (payslip_id, nature, type). '
  'Les documents famille appliquent une proratisation à la lecture.';

comment on column public.payslip_contribution_lines.nature is
  'Identifiant machine du poste, ex: retraite_ss_plaf, maladie_maternite, agirc_arrco_t1, csg_deductible…';
comment on column public.payslip_contribution_lines.type is
  'salariale = retenue sur le salaire du salarié ; patronale = charge de l''employeur';
comment on column public.payslip_contribution_lines.amount is
  'Montant en EUR. Positif = cotisation. Négatif = déduction (ex: déduction forfaitaire patronale).';
