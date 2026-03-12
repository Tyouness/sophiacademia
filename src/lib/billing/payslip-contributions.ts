/**
 * payslip-contributions — persistance détaillée des cotisations sociales.
 *
 * Responsabilité :
 *   Construire et persister les lignes de cotisation (payslip_contribution_lines)
 *   à partir des résultats agrégés de computeMonthlyPayslipData.
 *
 * Architecture :
 *   - Les cotisations sont rattachées au bulletin maître (payslips) uniquement.
 *   - Les documents famille les lisent via payslip_id et appliquent une proratisation.
 *   - Idempotent : onConflict (payslip_id, nature, type) → safe sur re-run.
 *
 * Deux sources :
 *   1. Cotisations salariales : agrégées dans computeMonthlyPayslipData (extension de PayslipComputeResult).
 *   2. Cotisations patronales : dérivées du grossTotal + totalHours + taux du rate set.
 *      Les taux patronaux sont proportionnels au brut ; le max(0,...) par cours ne mord
 *      jamais pour des taux horaires ≥ SMIC (12,02 €/h × 0,474 ≈ 7,11 € >> 2 €/h de déduction).
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getRateSet } from "@/lib/payroll/rates";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Forme d'une ligne de cotisation prête à insérer. */
export type ContributionRow = {
  payslip_id: string;
  nature: string;
  label: string;
  type: "salariale" | "patronale";
  base: number | null;
  rate: number | null;
  amount: number;
  rate_set_version: string;
};

/** Détail des cotisations salariales agrégées sur le mois. */
export type EmployeeContribsDetail = {
  retraite_ss_plaf: number;
  retraite_ss_deplaf: number;
  agirc_arrco_t1: number;
  ciid: number;
  csg_deductible: number;
  csg_non_deductible: number;
  crds: number;
  total: number;
};

// ── Construction des lignes salariales ───────────────────────────────────────

/**
 * Construit les lignes de cotisations salariales à partir des données agrégées.
 * La base CSG/CRDS = gross × 0.9825 (abattement forfaitaire) est recalculée ici.
 */
export function buildEmployeeContributionRows(params: {
  payslipId: string;
  grossTotal: number;
  contribs: EmployeeContribsDetail;
  rateSetVersion: string;
}): ContributionRow[] {
  const { payslipId, grossTotal, contribs, rateSetVersion } = params;
  const rateSet = getRateSet(rateSetVersion);
  const baseCsg = Number((grossTotal * rateSet.csgBaseRatio).toFixed(2));

  return [
    {
      payslip_id: payslipId,
      nature: "retraite_ss_plaf",
      label: "Retraite SS plafonnée",
      type: "salariale",
      base: grossTotal,
      rate: rateSet.employeeRates.retraiteSsPlaf,
      amount: contribs.retraite_ss_plaf,
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "retraite_ss_deplaf",
      label: "Retraite SS déplafonnée",
      type: "salariale",
      base: grossTotal,
      rate: rateSet.employeeRates.retraiteSsDeplaf,
      amount: contribs.retraite_ss_deplaf,
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "agirc_arrco_t1",
      label: "AGIRC-ARRCO T1",
      type: "salariale",
      base: grossTotal,
      rate: rateSet.employeeRates.agircArrcoT1,
      amount: contribs.agirc_arrco_t1,
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "ciid",
      label: "Prévoyance (CIID)",
      type: "salariale",
      base: grossTotal,
      rate: rateSet.employeeRates.ciid,
      amount: contribs.ciid,
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "csg_deductible",
      label: "CSG déductible de l'IR",
      type: "salariale",
      base: baseCsg,
      rate: rateSet.csgDeductibleRate,
      amount: contribs.csg_deductible,
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "csg_non_deductible",
      label: "CSG non déductible de l'IR",
      type: "salariale",
      base: baseCsg,
      rate: rateSet.csgNonDeductibleRate,
      amount: contribs.csg_non_deductible,
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "crds",
      label: "CRDS",
      type: "salariale",
      base: baseCsg,
      rate: rateSet.crdsRate,
      amount: contribs.crds,
      rate_set_version: rateSetVersion,
    },
  ];
}

// ── Construction des lignes patronales ────────────────────────────────────────

/**
 * Construit les lignes de cotisations patronales à partir du brut total et du rate set.
 * La déduction forfaitaire patronale (art. D7231-1 : 2 €/h) est incluse comme montant négatif.
 */
export function buildEmployerContributionRows(params: {
  payslipId: string;
  grossTotal: number;
  totalHours: number;
  rateSetVersion: string;
}): ContributionRow[] {
  const { payslipId, grossTotal, totalHours, rateSetVersion } = params;
  // Garde-fou : incohérence heures/brut indique un bug amont dans computeMonthlyPayslip.
  if (totalHours === 0 && grossTotal > 0) {
    throw new Error(
      `contribution_hours_mismatch: grossTotal=${grossTotal} totalHours=0`,
    );
  }
  const rateSet = getRateSet(rateSetVersion);
  const r = rateSet.employerRates;
  const round2 = (v: number) => Number(v.toFixed(2));

  const rows: ContributionRow[] = [
    {
      payslip_id: payslipId,
      nature: "maladie_maternite",
      label: "Maladie-Maternité-Invalidité-Décès",
      type: "patronale",
      base: grossTotal,
      rate: r.maladieMaterniteInvalDeces,
      amount: round2(grossTotal * r.maladieMaterniteInvalDeces),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "csa",
      label: "Contribution Solidarité Autonomie",
      type: "patronale",
      base: grossTotal,
      rate: r.csa,
      amount: round2(grossTotal * r.csa),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "compl_incap_inval_deces",
      label: "Comp. incap./inval./décès",
      type: "patronale",
      base: grossTotal,
      rate: r.complIncapInvalDeces,
      amount: round2(grossTotal * r.complIncapInvalDeces),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "at_mp",
      label: "Accidents du travail / Maladies professionnelles",
      type: "patronale",
      base: grossTotal,
      rate: r.atMp,
      amount: round2(grossTotal * r.atMp),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "retraite_ss_plaf_pat",
      label: "Retraite SS plafonnée (part patronale)",
      type: "patronale",
      base: grossTotal,
      rate: r.retraiteSsPlaf,
      amount: round2(grossTotal * r.retraiteSsPlaf),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "retraite_ss_deplaf_pat",
      label: "Retraite SS déplafonnée (part patronale)",
      type: "patronale",
      base: grossTotal,
      rate: r.retraiteSsDeplaf,
      amount: round2(grossTotal * r.retraiteSsDeplaf),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "agirc_arrco_t1_pat",
      label: "AGIRC-ARRCO T1 (part patronale)",
      type: "patronale",
      base: grossTotal,
      rate: r.agircArrcoT1,
      amount: round2(grossTotal * r.agircArrcoT1),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "allocations_familiales",
      label: "Allocations familiales",
      type: "patronale",
      base: grossTotal,
      rate: r.famille,
      amount: round2(grossTotal * r.famille),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "chomage",
      label: "Assurance chômage",
      type: "patronale",
      base: grossTotal,
      rate: r.chomage,
      amount: round2(grossTotal * r.chomage),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "autres_pat",
      label: "Autres cotisations patronales",
      type: "patronale",
      base: grossTotal,
      rate: r.autres,
      amount: round2(grossTotal * r.autres),
      rate_set_version: rateSetVersion,
    },
    {
      payslip_id: payslipId,
      nature: "sante_travail",
      label: "Santé au travail",
      type: "patronale",
      base: grossTotal,
      rate: r.santeTravail,
      amount: round2(grossTotal * r.santeTravail),
      rate_set_version: rateSetVersion,
    },
    {
      // Déduction forfaitaire patronale SAP (art. D7231-1 C. trav.) — montant négatif
      payslip_id: payslipId,
      nature: "deduction_forfaitaire_pat",
      label: "Déduction forfaitaire patronale (SAP)",
      type: "patronale",
      base: null,
      rate: null,
      amount: round2(-rateSet.employerDeductionPerHour * totalHours),
      rate_set_version: rateSetVersion,
    },
  ];

  return rows;
}

// ── Persistance ───────────────────────────────────────────────────────────────

/**
 * Construit et upsert toutes les lignes de cotisations (salariales + patronales)
 * pour un bulletin maître donné.
 *
 * Idempotent : safe sur re-run (onConflict: payslip_id, nature, type).
 * Non bloquant si appelé dans un try/catch par l'orchestrateur.
 */
export async function persistPayslipContributions(params: {
  payslipId: string;
  grossTotal: number;
  totalHours: number;
  employeeContribsDetail: EmployeeContribsDetail;
  rateSetVersion: string;
}): Promise<void> {
  const { payslipId, grossTotal, totalHours, employeeContribsDetail, rateSetVersion } = params;

  const employeeRows = buildEmployeeContributionRows({
    payslipId,
    grossTotal,
    contribs: employeeContribsDetail,
    rateSetVersion,
  });

  const employerRows = buildEmployerContributionRows({
    payslipId,
    grossTotal,
    totalHours,
    rateSetVersion,
  });

  const allRows = [...employeeRows, ...employerRows];

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("payslip_contribution_lines")
    .upsert(allRows, { onConflict: "payslip_id,nature,type" });

  if (error) {
    throw new Error(`persistPayslipContributions failed: ${error.message}`);
  }
}
