-- Migration 0025: Add payslip_family_documents — couche documentaire SAP mandataire.
--
-- Objectif :
--   Conserver le bulletin maître agrégé (payslips, 1 par professeur×mois) tel quel,
--   et ajouter une table de documents de bulletin par famille/particulier employeur.
--
--   En modèle SAP mandataire (L7232-6 C. trav.), l'employeur légal est le particulier
--   employeur (la famille). Cette table porte les documents PDF émis à chaque famille
--   pour les cours effectués ce mois par un professeur donné.
--
-- Chaque enregistrement correspond à :
--   1 professeur × 1 famille × 1 période = 1 document PDF employeur.
--
-- La table est strictement additive : aucune modification de payslips, payslip_lines
-- ni de la contrainte unique (professor_id, period).

create table if not exists public.payslip_family_documents (
  id                  uuid primary key default gen_random_uuid(),

  -- Lien vers le bulletin maître agrégé
  payslip_id          uuid not null references public.payslips(id) on delete cascade,

  -- Particulier employeur (famille) — employeur légal en mode mandataire
  family_id           uuid not null references public.profiles(id) on delete cascade,

  -- Période (copie dénormalisée pour requêtes directes sans JOIN)
  period              text not null,

  -- Totaux calculés pour cette famille uniquement
  gross_total         numeric,
  net_total           numeric,
  reimbursements_total numeric,

  -- Document PDF généré
  pdf_path            text,
  pdf_url             text,

  created_at          timestamp with time zone not null default now(),
  updated_at          timestamp with time zone not null default now()
);

-- Un seul document par combinaison bulletin maître × famille
create unique index if not exists payslip_family_documents_unique_idx
  on public.payslip_family_documents (payslip_id, family_id);

-- Index pour accès par famille (ex. : liste des documents d'une famille)
create index if not exists payslip_family_documents_family_idx
  on public.payslip_family_documents (family_id);

-- Index pour accès par période (ex. : tous les documents d'un mois)
create index if not exists payslip_family_documents_period_idx
  on public.payslip_family_documents (period);

-- Trigger updated_at
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_payslip_family_documents_updated_at'
  ) then
    create trigger set_payslip_family_documents_updated_at
      before update on public.payslip_family_documents
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- RLS
alter table public.payslip_family_documents enable row level security;

-- Staff et admin : accès total (lecture + écriture)
drop policy if exists "payslip_family_documents_staff_all" on public.payslip_family_documents;
create policy "payslip_family_documents_staff_all"
  on public.payslip_family_documents
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- Professeur : lecture de ses propres documents famille
drop policy if exists "payslip_family_documents_professor_select" on public.payslip_family_documents;
create policy "payslip_family_documents_professor_select"
  on public.payslip_family_documents
  for select
  using (
    exists (
      select 1
      from public.payslips p
      where p.id = payslip_id
        and p.professor_id = auth.uid()
    )
  );

comment on table public.payslip_family_documents is
  'Documents de bulletin par particulier employeur (famille) en mode SAP mandataire. '
  '1 enregistrement = 1 professeur × 1 famille × 1 période. '
  'Le bulletin maître agrégé reste dans la table payslips.';
