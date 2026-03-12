/**
 * Couche documentaire SAP mandataire — documents de paie par famille / particulier employeur.
 *
 * En mode SAP mandataire (art. L7232-6 Code du travail), l'employeur légal est le particulier
 * employeur (la famille). Ce module génère un document PDF par famille à partir des lignes de
 * paie qui lui appartiennent, rattachées au bulletin maître agrégé (payslips).
 *
 * Le bulletin maître (payslips) n'est PAS modifié.
 * Cette couche est strictement additive.
 */

import PDFDocument from "pdfkit";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { decryptSensitive } from "@/lib/security/crypto";
import { maskNir } from "@/lib/payroll/nir";
import type { ContributionRow } from "@/lib/billing/payslip-contributions";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Une ligne de payslip enrichie du family_id récupéré via courses. */
export type FamilyPayslipLine = {
  course_id: string;
  hours: number;
  net_amount: number;
  indemn_km: number;
  /** Peut être null si le cours n'est rattaché à aucune famille. */
  family_id: string | null;
};

/** Regroupement des lignes d'une même famille avec les totaux calculés. */
export type FamilyGroup = {
  family_id: string;
  lines: FamilyPayslipLine[];
  gross_total: number;
  net_total: number;
  reimbursements_total: number;
};

// ── Fonction pure : regroupement par famille ──────────────────────────────────

/**
 * Regroupe les lignes de paie par family_id.
 *
 * Les lignes dont family_id est null sont ignorées (cours sans famille rattachée —
 * ne doivent pas apparaître dans un document employeur).
 *
 * Les totaux sont calculés avec une précision de 2 décimales.
 */
export function groupLinesByFamily(lines: FamilyPayslipLine[]): Map<string, FamilyGroup> {
  const groups = new Map<string, FamilyGroup>();

  for (const line of lines) {
    if (!line.family_id) continue; // cours sans famille — exclus des documents employeur

    let group = groups.get(line.family_id);
    if (!group) {
      group = {
        family_id: line.family_id,
        lines: [],
        gross_total: 0,
        net_total: 0,
        reimbursements_total: 0,
      };
      groups.set(line.family_id, group);
    }

    group.lines.push(line);
    // Brut estimé = net + cotisations salariales ≈ net × 1.22 (approximation documentaire)
    // Note : gross exact est sur le bulletin maître ; ici on documente le net et les IK de la famille.
    group.net_total = Number((group.net_total + line.net_amount).toFixed(2));
    group.reimbursements_total = Number((group.reimbursements_total + line.indemn_km).toFixed(2));
  }

  // gross_total : non calculable ligne par ligne sans re-appliquer le moteur de cotisations.
  // On le laisse à 0 ici ; il sera renseigné par interpolation proportionnelle dans generateFamilyPayslipDocuments.

  return groups;
}

// ── Génération PDF ────────────────────────────────────────────────────────────

type ProfessorData = {
  full_name: string | null;
  nir_encrypted: string | null;
  job_title: string | null;
  addr1: string | null;
  addr2: string | null;
  postcode: string | null;
  city: string | null;
};

type FamilyData = {
  rep_first: string | null;
  rep_last: string | null;
  addr1: string | null;
  addr2: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
};

type MasterPayslip = {
  id: string;
  number: string | null;
  period: string | null;
  period_start: string | null;
  period_end: string | null;
  gross_salary_total: number | null;
  net_salary_total: number | null;
};

/**
 * Génère le buffer PDF d'un document de paie pour une famille / particulier employeur.
 * La proportion brut famille = brut maître × (net_famille / net_maître).
 */
function buildFamilyPDFBuffer(params: {
  master: MasterPayslip;
  professor: ProfessorData;
  family: FamilyData;
  group: FamilyGroup;
  contribLines: Pick<ContributionRow, "nature" | "label" | "type" | "base" | "rate" | "amount">[];
}): Promise<Buffer> {
  const { master, professor, family, group, contribLines } = params;

  // Proportion brut famille / brut maître basée sur les nets
  const masterNet = master.net_salary_total ?? 0;
  const ratio = masterNet > 0 ? group.net_total / masterNet : 0;
  const grossFamily = Number(((master.gross_salary_total ?? 0) * ratio).toFixed(2));

  // Proratiser les lignes de cotisations
  const proratedSal = contribLines
    .filter((r) => r.type === "salariale")
    .map((r) => ({ ...r, amount: Number((r.amount * ratio).toFixed(2)), base: r.base != null ? Number((r.base * ratio).toFixed(2)) : null }));

  const proratedPat = contribLines
    .filter((r) => r.type === "patronale")
    .map((r) => ({ ...r, amount: Number((r.amount * ratio).toFixed(2)), base: r.base != null ? Number((r.base * ratio).toFixed(2)) : null }));

  // Fallback si pas de cotisations DB. Math.max(0, ...) empêche un montant négatif
  // si une erreur d'arrondi rend grossFamily légèrement < group.net_total.
  const cotisationsSal = Math.max(0, Number((grossFamily - group.net_total).toFixed(2)));

  const fmt = (v: number | null | undefined, decimals = 2) =>
    v != null ? `${v.toFixed(decimals)} €` : "—";

  const mandataireNom    = process.env.COMPANY_NAME    ?? "Sophiacademia";
  const mandataireSiret  = process.env.COMPANY_SIRET   ?? "— SIRET non configuré —";
  const mandataireAdress = process.env.COMPANY_ADDRESS ?? "— adresse non configurée —";

  const repName = [family.rep_first, family.rep_last].filter(Boolean).join(" ") || "— non renseigné —";
  const famAddrLine = [
    family.addr1,
    family.addr2,
    `${family.postcode ?? ""} ${family.city ?? ""}`.trim(),
    family.country,
  ].filter(Boolean).join(", ");

  let nirMasked = "— non renseigné —";
  if (professor.nir_encrypted) {
    try {
      nirMasked = maskNir(decryptSensitive(professor.nir_encrypted));
    } catch {
      nirMasked = "— erreur déchiffrement —";
    }
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── En-tête ───────────────────────────────────────────────────────────
    doc.fontSize(15).font("Helvetica-Bold")
      .text("DOCUMENT DE PAIE — PARTICULIER EMPLOYEUR", { align: "center" });
    doc.fontSize(8).font("Helvetica")
      .text("établi dans le cadre du service à la personne en mode mandataire (art. L7232-6 C. trav.)", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica")
      .text(
        `Numéro bulletin maître : ${master.number ?? master.id}   |   Période : ${master.period ?? "—"}`,
        { align: "center" },
      );
    if (master.period_start && master.period_end) {
      doc.fontSize(9).text(`Du ${master.period_start} au ${master.period_end}`, { align: "center" });
    }
    doc.moveDown(1);

    // ── Employeur : particulier employeur ─────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("EMPLOYEUR — PARTICULIER EMPLOYEUR");
    doc.fontSize(9).font("Helvetica");
    doc.text(`Nom : ${repName}`);
    if (famAddrLine) doc.text(`Adresse : ${famAddrLine}`);
    doc.text("Qualité : Particulier employeur (art. L7231-1 C. trav.)");
    doc.moveDown(0.8);

    // ── Mandataire gestionnaire ───────────────────────────────────────────
    doc.fontSize(10).font("Helvetica-Bold").text("Mandataire gestionnaire");
    doc.fontSize(9).font("Helvetica");
    doc.text(`Raison sociale : ${mandataireNom}`);
    doc.text(`SIRET : ${mandataireSiret}`);
    doc.text(`Adresse : ${mandataireAdress}`);
    doc.text("Rôle : mandataire — établit et gère les bulletins au nom du particulier employeur");
    doc.moveDown(1);

    // ── Salarié ───────────────────────────────────────────────────────────
    const profName = professor.full_name ?? "—";
    const jobTitle = professor.job_title ?? "Enseignant(e) à domicile";
    const profAddrLine = [professor.addr1, `${professor.postcode ?? ""} ${professor.city ?? ""}`.trim()]
      .filter(Boolean).join(", ");

    doc.fontSize(11).font("Helvetica-Bold").text("SALARIÉ(E)");
    doc.fontSize(9).font("Helvetica");
    doc.text(`Nom : ${profName}`);
    doc.text(`Emploi : ${jobTitle}`);
    doc.text(`N° SS (NIR) : ${nirMasked}`);
    if (profAddrLine.trim()) doc.text(`Adresse : ${profAddrLine}`);
    doc.moveDown(1);

    // ── Séances de cours de cette famille ─────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("SÉANCES EFFECTUÉES POUR CET EMPLOYEUR");
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica");

    const colX = [40, 130, 230, 340];
    doc.font("Helvetica-Bold")
      .text("Cours ID (court)", colX[0], doc.y, { continued: true, width: 85 })
      .text("Heures", colX[1], doc.y, { continued: true, width: 95 })
      .text("Net cours", colX[2], doc.y, { continued: true, width: 105 })
      .text("Indemn. km", colX[3], doc.y, { width: 140 });
    doc.moveDown(0.2);
    doc.font("Helvetica");

    for (const line of group.lines) {
      const shortId = line.course_id.slice(-8);
      const y = doc.y;
      doc.text(`…${shortId}`, colX[0], y, { continued: true, width: 85 })
        .text(line.hours != null ? `${line.hours}h` : "—", colX[1], y, { continued: true, width: 95 })
        .text(fmt(line.net_amount), colX[2], y, { continued: true, width: 105 })
        .text(fmt(line.indemn_km), colX[3], y, { width: 140 });
    }
    doc.moveDown(1);

    // ── Récapitulatif famille ─────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("RÉCAPITULATIF — CET EMPLOYEUR");
    doc.moveDown(0.3);

    // Brut + net
    doc.fontSize(9).font("Helvetica");
    doc.text("Salaire brut estimé (proportion des heures)", 40, doc.y, { continued: true, width: 300 });
    doc.text(fmt(grossFamily), 340, doc.y, { width: 170, align: "right" });

    // Cotisations salariales (proratées ou fallback)
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica-Bold").text("Cotisations salariales (proratées)");
    doc.moveDown(0.1);
    if (proratedSal.length > 0) {
      const cColX = [40, 220, 305, 390];
      doc.fontSize(7).font("Helvetica-Bold");
      doc.text("Nature",   cColX[0], doc.y, { continued: true, width: 175 })
         .text("Base (€)", cColX[1], doc.y, { continued: true, width: 80, align: "right" })
         .text("Taux",     cColX[2], doc.y, { continued: true, width: 80, align: "right" })
         .text("Montant",  cColX[3], doc.y, { width: 120, align: "right" });
      doc.moveDown(0.1);
      doc.font("Helvetica");
      for (const r of proratedSal) {
        const y = doc.y;
        doc.text(r.label, cColX[0], y, { continued: true, width: 175 })
           .text(r.base != null ? r.base.toFixed(2) : "—", cColX[1], y, { continued: true, width: 80, align: "right" })
           .text(r.rate != null ? `${(r.rate * 100).toFixed(3)} %` : "—", cColX[2], y, { continued: true, width: 80, align: "right" })
           .text(fmt(r.amount), cColX[3], y, { width: 120, align: "right" });
      }
    } else {
      doc.fontSize(8).font("Helvetica");
      doc.text("Cotisations salariales estimées", 40, doc.y, { continued: true, width: 300 });
      doc.text(fmt(cotisationsSal > 0 ? cotisationsSal : null), 340, doc.y, { width: 170, align: "right" });
    }

    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica");
    doc.text("Net social", 40, doc.y, { continued: true, width: 300 });
    doc.text(fmt(group.net_total), 340, doc.y, { width: 170, align: "right" });
    doc.text("Indemnités kilométriques", 40, doc.y, { continued: true, width: 300 });
    doc.text(fmt(group.reimbursements_total), 340, doc.y, { width: 170, align: "right" });
    // ── Cotisations patronales proratées (informatives) ──────────────────────
    if (proratedPat.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica-Bold").text("Charges patronales proratées (à titre informatif)");
      doc.moveDown(0.1);
      const cColX = [40, 220, 305, 390];
      doc.fontSize(7).font("Helvetica-Bold");
      doc.text("Nature",   cColX[0], doc.y, { continued: true, width: 175 })
         .text("Base (€)", cColX[1], doc.y, { continued: true, width: 80, align: "right" })
         .text("Taux",     cColX[2], doc.y, { continued: true, width: 80, align: "right" })
         .text("Montant",  cColX[3], doc.y, { width: 120, align: "right" });
      doc.moveDown(0.1);
      doc.font("Helvetica");
      for (const r of proratedPat) {
        const y = doc.y;
        doc.text(r.label, cColX[0], y, { continued: true, width: 175 })
           .text(r.base != null ? r.base.toFixed(2) : "—", cColX[1], y, { continued: true, width: 80, align: "right" })
           .text(r.rate != null ? `${(r.rate * 100).toFixed(3)} %` : "—", cColX[2], y, { continued: true, width: 80, align: "right" })
           .text(fmt(r.amount), cColX[3], y, { width: 120, align: "right" });
      }
    }

    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("NET À PAYER (CET EMPLOYEUR)", 40, doc.y, { continued: true, width: 300 });
    doc.text(
      fmt(group.net_total + group.reimbursements_total),
      340, doc.y, { width: 170, align: "right" },
    );
    doc.moveDown(0.5);
    doc.fontSize(7).font("Helvetica").text(
      "* Le brut et les cotisations indiqués sont proratés à proportion du net de cet employeur "
      + "sur l'ensemble du mois. Les montants exacts figurent sur le bulletin maître.",
    );
    doc.moveDown(1);

    // ── Pied de page légal ────────────────────────────────────────────────
    doc.fontSize(7).font("Helvetica").text(
      "Ce document est à conserver sans limitation de durée (art. L3243-4 C. trav.). " +
      "Il est établi en mode mandataire : l'employeur légal est le particulier employeur désigné ci-dessus ; " +
      mandataireNom + " intervient en qualité de mandataire gestionnaire uniquement. " +
      "Cotisations calculées selon les taux en vigueur au 01/01/2026.",
      { align: "justify" },
    );

    doc.end();
  });
}

function buildPublicStorageUrl(bucket: string, path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

// ── Orchestrateur principal ───────────────────────────────────────────────────

/**
 * Résultat de la génération des documents famille pour un bulletin donné.
 * created : nombre de documents PDF générés et persistés avec succès.
 * failed  : nombre de familles pour lesquelles la génération a échoué (upload ou upsert).
 * errors  : détail des erreurs par famille (non bloquantes — les autres familles sont
 *           traitées même si une échoue).
 */
export type FamilyDocResult = {
  created: number;
  failed: number;
  errors: Array<{ familyId: string; message: string }>;
};

/**
 * Génère un document PDF de paie par famille / particulier employeur à partir
 * d'un bulletin maître.
 *
 * Étapes :
 * 1. Charge les lignes de payslip enrichies du family_id (via JOIN courses)
 * 2. Regroupe par famille via groupLinesByFamily
 * 3. Pour chaque famille : génère un PDF, l'uploade, upsert dans payslip_family_documents
 *
 * Retourne un FamilyDocResult avec les compteurs réels créés / échoués.
 * Ne modifie pas la table payslips ni payslip_lines.
 */
export async function generateFamilyPayslipDocuments(payslipId: string): Promise<FamilyDocResult> {
  const supabase = createAdminSupabaseClient();

  // ── 1. Charger le bulletin maître ─────────────────────────────────────────
  const { data: master, error: masterError } = await supabase
    .from("payslips")
    .select("id, professor_id, number, period, period_start, period_end, gross_salary_total, net_salary_total")
    .eq("id", payslipId)
    .single();

  if (masterError || !master) {
    throw new Error(masterError?.message ?? "payslip_not_found");
  }

  // ── 2. Lignes enrichies du family_id via courses ──────────────────────────
  const { data: rawLines, error: linesError } = await supabase
    .from("payslip_lines")
    .select("course_id, hours, net_amount, indemn_km, courses!inner(family_id)")
    .eq("payslip_id", payslipId);

  if (linesError) {
    throw new Error(linesError.message);
  }

  if (!rawLines || rawLines.length === 0) {
    return { created: 0, failed: 0, errors: [] }; // Rien à documenter
  }

  // Normalise le résultat du JOIN
  const lines: FamilyPayslipLine[] = rawLines.map((row) => ({
    course_id: row.course_id,
    hours: Number(row.hours),
    net_amount: Number(row.net_amount),
    indemn_km: Number(row.indemn_km),
    family_id: Array.isArray(row.courses)
      ? (row.courses[0]?.family_id ?? null)
      : ((row.courses as { family_id: string | null } | null)?.family_id ?? null),
  }));

  // ── 3. Regroupement par famille ───────────────────────────────────────────
  const groups = groupLinesByFamily(lines);

  if (groups.size === 0) {
    return { created: 0, failed: 0, errors: [] }; // Tous les cours sans famille — rien à documenter
  }

  // ── 4. Charger l'identité du professeur (une seule fois) ──────────────────
  const { data: profProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", master.professor_id)
    .maybeSingle();

  const { data: profExtra } = await supabase
    .from("professor_profiles")
    .select("nir_encrypted, job_title, addr1, addr2, postcode, city")
    .eq("id", master.professor_id)
    .maybeSingle();

  const professor: ProfessorData = {
    full_name: profProfile?.full_name ?? null,
    nir_encrypted: profExtra?.nir_encrypted ?? null,
    job_title: profExtra?.job_title ?? null,
    addr1: profExtra?.addr1 ?? null,
    addr2: profExtra?.addr2 ?? null,
    postcode: profExtra?.postcode ?? null,
    city: profExtra?.city ?? null,
  };
  // ── 4b. Charger les lignes de cotisations (pour proratisation) ──────────────
  const { data: masterContribLines } = await supabase
    .from("payslip_contribution_lines")
    .select("nature, label, type, base, rate, amount")
    .eq("payslip_id", payslipId)
    .order("type")
    .order("nature");

  const contribLines: Pick<ContributionRow, "nature" | "label" | "type" | "base" | "rate" | "amount">[] =
    (masterContribLines ?? []) as Pick<ContributionRow, "nature" | "label" | "type" | "base" | "rate" | "amount">[];
  // ── 5. Générer un PDF par famille ─────────────────────────────────────────
  let created = 0;
  let failed = 0;
  const docErrors: Array<{ familyId: string; message: string }> = [];

  for (const [familyId, group] of groups) {
    // Charger l'identité de la famille (particulier employeur)
    const { data: famProfile } = await supabase
      .from("family_profiles")
      .select("rep_first, rep_last, addr1, addr2, postcode, city, country")
      .eq("id", familyId)
      .maybeSingle();

    const family: FamilyData = {
      rep_first: famProfile?.rep_first ?? null,
      rep_last:  famProfile?.rep_last  ?? null,
      addr1:     famProfile?.addr1     ?? null,
      addr2:     famProfile?.addr2     ?? null,
      postcode:  famProfile?.postcode  ?? null,
      city:      famProfile?.city      ?? null,
      country:   famProfile?.country   ?? null,
    };

    // Générer le PDF
    const pdfBuffer = await buildFamilyPDFBuffer({ master, professor, family, group, contribLines });

    // Chemin : payslips/{period}/{bulletinNumber}/famille-{familyId-short}.pdf
    const shortFamilyId = familyId.slice(-8);
    const folderName = master.number ?? `payslip-${master.id}`;
    const storagePath = `${master.period ?? "unknown"}/${folderName}/famille-${shortFamilyId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("payslips")
      .upload(storagePath, pdfBuffer, { upsert: true, contentType: "application/pdf" });

    if (uploadError) {
      // Non bloquant : on log et on continue pour les autres familles
      console.error(`[generateFamilyPayslipDocuments] upload failed for family ${familyId}:`, uploadError.message);
      failed++;
      docErrors.push({ familyId, message: `upload: ${uploadError.message}` });
      continue;
    }

    const pdfUrl = buildPublicStorageUrl("payslips", storagePath)
      ?? `/api/billing/payslips/${payslipId}/famille/${familyId}/pdf`;

    // Upsert dans payslip_family_documents
    const { error: upsertError } = await supabase
      .from("payslip_family_documents")
      .upsert(
        {
          payslip_id:           payslipId,
          family_id:            familyId,
          period:               master.period ?? "",
          gross_total:          group.gross_total,
          net_total:            group.net_total,
          reimbursements_total: group.reimbursements_total,
          pdf_path:             storagePath,
          pdf_url:              pdfUrl,
          updated_at:           new Date().toISOString(),
        },
        { onConflict: "payslip_id,family_id" },
      );

    if (upsertError) {
      console.error(`[generateFamilyPayslipDocuments] upsert failed for family ${familyId}:`, upsertError.message);
      failed++;
      docErrors.push({ familyId, message: `upsert: ${upsertError.message}` });
      continue;
    }

    created++;
  }

  return { created, failed, errors: docErrors };
}
