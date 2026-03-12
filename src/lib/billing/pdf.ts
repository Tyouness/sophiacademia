import PDFDocument from "pdfkit";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { decryptSensitive } from "@/lib/security/crypto";
import { maskNir } from "@/lib/payroll/nir";

function buildPublicStorageUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    return null;
  }
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export async function generateInvoicePDF(invoiceId: string) {
  const supabase = createAdminSupabaseClient();
  const pdfUrl = `/api/billing/invoices/${invoiceId}/pdf`;
  const { error } = await supabase
    .from("invoices")
    .update({ pdf_url: pdfUrl })
    .eq("id", invoiceId);

  if (error) {
    throw new Error(error.message);
  }

  return pdfUrl;
}

export async function generatePayslipPDF(payslipId: string) {
  const supabase = createAdminSupabaseClient();

  // ── 1. Fetch payslip header ──────────────────────────────────────────────
  const { data: payslip, error: payslipError } = await supabase
    .from("payslips")
    .select(
      "id, professor_id, number, period, period_start, period_end, gross_salary_total, net_salary_total, reimbursements_total, employer_contribs_total, total_net, total_indemn_km",
    )
    .eq("id", payslipId)
    .single();

  if (payslipError || !payslip) {
    throw new Error(payslipError?.message ?? "payslip_not_found");
  }

  // ── 2. Fetch professor identity ──────────────────────────────────────────
  const { data: profProfile } = await supabase
    .from("profiles")
    .select("full_name, email, addr1, addr2, postcode, city, country")
    .eq("id", payslip.professor_id)
    .maybeSingle();

  const { data: profExtra } = await supabase
    .from("professor_profiles")
    .select("nir_encrypted, job_title, employment_status, employer_name, addr1, addr2, postcode, city, country")
    .eq("id", payslip.professor_id)
    .maybeSingle();

  // Masked NIR — never put raw NIR in any file upload
  let nirMasked = "— non renseigné —";
  if (profExtra?.nir_encrypted) {
    try {
      nirMasked = maskNir(decryptSensitive(profExtra.nir_encrypted));
    } catch {
      nirMasked = "— erreur déchiffrement —";
    }
  }

  // ── 3. Fetch payslip lines ───────────────────────────────────────────────
  const { data: lines } = await supabase
    .from("payslip_lines")
    .select("course_id, hours, net_amount, indemn_km")
    .eq("payslip_id", payslipId)
    .order("course_id");

  // ── 3b. Fetch contribution lines (salariales + patronales) ──────────────
  const { data: contribLines } = await supabase
    .from("payslip_contribution_lines")
    .select("nature, label, type, base, rate, amount")
    .eq("payslip_id", payslipId)
    .order("type")
    .order("nature");

  const salLines = (contribLines ?? []).filter((r) => r.type === "salariale");
  const patLines = (contribLines ?? []).filter((r) => r.type === "patronale");

  // ── 4. Mandataire gestionnaire (≠ employeur légal) ──────────────────────
  //
  // En modèle SAP mandataire (art. L7232-6 Code du travail), l'employeur légal
  // est le particulier employeur (la famille), pas la société mandataire.
  // Ce bulletin est consolidé sur l'ensemble des familles du mois : il n'est pas
  // possible d'identifier un unique particulier employeur sans restructuration du
  // modèle payslip (actuellement : 1 bulletin / professeur / période, toutes familles).
  //
  // Sophiacademia apparaît ici uniquement comme mandataire gestionnaire (établissement
  // du bulletin, déclarations sociales). L'identification des particuliers employeurs
  // est portée par les contrats de mission individuels, non par ce bulletin consolidé.
  const mandataireNom    = process.env.COMPANY_NAME    ?? "Sophiacademia";
  const mandataireSiret  = process.env.COMPANY_SIRET   ?? "— SIRET non configuré —";
  const mandataireAdress = process.env.COMPANY_ADDRESS ?? "— adresse non configurée —";

  // ── 5. Build PDF with PDFKit ─────────────────────────────────────────────
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fmt = (v: number | null | undefined, decimals = 2) =>
      v != null ? `${v.toFixed(decimals)} €` : "—";

    // ── Header ────────────────────────────────────────────────────────────
    doc.fontSize(16).font("Helvetica-Bold").text("BULLETIN DE PAIE", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").text(
      `Numéro : ${payslip.number ?? payslip.id}   |   Période : ${payslip.period ?? "—"}`,
      { align: "center" },
    );
    if (payslip.period_start && payslip.period_end) {
      doc.fontSize(9).text(
        `Du ${payslip.period_start} au ${payslip.period_end}`,
        { align: "center" },
      );
    }
    doc.moveDown(1);

    // ── Employeur légal + mandataire ─────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("EMPLOYEUR (PARTICULIER EMPLOYEUR — SAP MANDATAIRE)");
    doc.fontSize(9).font("Helvetica");
    doc.text("Type : Particulier employeur — modèle mandataire (art. L7232-6 C. trav.)");
    doc.text("Identification : portée par les contrats de mission individuels");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica-Bold").text("Mandataire gestionnaire");
    doc.fontSize(9).font("Helvetica");
    doc.text(`Raison sociale : ${mandataireNom}`);
    doc.text(`SIRET : ${mandataireSiret}`);
    doc.text(`Adresse : ${mandataireAdress}`);
    doc.moveDown(1);

    // ── Employee block ────────────────────────────────────────────────────
    const empName    = profProfile?.full_name ?? "—";
    const empAddr1   = profExtra?.addr1  ?? profProfile?.addr1  ?? "";
    const empAddr2   = profExtra?.addr2  ?? profProfile?.addr2  ?? "";
    const empPostcode = profExtra?.postcode ?? profProfile?.postcode ?? "";
    const empCity    = profExtra?.city   ?? profProfile?.city   ?? "";
    const jobTitle   = profExtra?.job_title ?? "Enseignant(e) à domicile";

    doc.fontSize(11).font("Helvetica-Bold").text("SALARIÉ(E)");
    doc.fontSize(9).font("Helvetica");
    doc.text(`Nom : ${empName}`);
    doc.text(`Emploi : ${jobTitle}`);
    doc.text(`N° SS (NIR) : ${nirMasked}`);
    const addrLine = [empAddr1, empAddr2, `${empPostcode} ${empCity}`].filter(Boolean).join(", ");
    if (addrLine.trim()) doc.text(`Adresse : ${addrLine}`);
    doc.moveDown(1);

    // ── Courses table ─────────────────────────────────────────────────────
    if (lines && lines.length > 0) {
      doc.fontSize(11).font("Helvetica-Bold").text("DÉTAIL DES SÉANCES");
      doc.moveDown(0.3);
      doc.fontSize(9).font("Helvetica");

      const colX = [40, 130, 220, 320, 420];
      doc.font("Helvetica-Bold")
        .text("Cours ID (court)", colX[0], doc.y, { continued: true, width: 85 })
        .text("Heures", colX[1], doc.y, { continued: true, width: 85 })
        .text("Net cours", colX[2], doc.y, { continued: true, width: 95 })
        .text("Indemn. km", colX[3], doc.y, { width: 100 });
      doc.moveDown(0.2);
      doc.font("Helvetica");

      for (const line of lines) {
        const shortId = line.course_id.slice(-8);
        const y = doc.y;
        doc.text(`…${shortId}`, colX[0], y, { continued: true, width: 85 })
          .text(line.hours != null ? `${line.hours}h` : "—", colX[1], y, { continued: true, width: 85 })
          .text(fmt(line.net_amount), colX[2], y, { continued: true, width: 95 })
          .text(fmt(line.indemn_km), colX[3], y, { width: 100 });
      }
      doc.moveDown(1);
    }

    // ── Cotisations salariales ─────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("COTISATIONS SALARIALES");
    doc.moveDown(0.2);
    if (salLines.length > 0) {
      const cColX = [40, 230, 315, 400];
      doc.fontSize(8).font("Helvetica-Bold");
      doc.text("Nature",   cColX[0], doc.y, { continued: true, width: 185 })
         .text("Base (€)", cColX[1], doc.y, { continued: true, width: 80, align: "right" })
         .text("Taux",     cColX[2], doc.y, { continued: true, width: 80, align: "right" })
         .text("Montant",  cColX[3], doc.y, { width: 100, align: "right" });
      doc.moveDown(0.1);
      doc.font("Helvetica");
      for (const r of salLines) {
        const y = doc.y;
        doc.text(r.label, cColX[0], y, { continued: true, width: 185 })
           .text(r.base != null ? r.base.toFixed(2) : "—", cColX[1], y, { continued: true, width: 80, align: "right" })
           .text(r.rate != null ? `${(r.rate * 100).toFixed(3)} %` : "—", cColX[2], y, { continued: true, width: 80, align: "right" })
           .text(fmt(r.amount), cColX[3], y, { width: 100, align: "right" });
      }
      const totalSal = salLines.reduce((s, r) => s + (r.amount ?? 0), 0);
      doc.moveDown(0.1);
      doc.font("Helvetica-Bold");
      doc.text("Total cotisations salariales", cColX[0], doc.y, { continued: true, width: 355 })
         .text(fmt(totalSal), cColX[3], doc.y, { width: 100, align: "right" });
      doc.font("Helvetica");
    } else {
      // Fallback si cotisations non encore persistées
      doc.fontSize(9).font("Helvetica");
      doc.text("Salaire brut", 40, doc.y, { continued: true, width: 300 });
      doc.text(fmt(payslip.gross_salary_total), 340, doc.y, { width: 150, align: "right" });
      doc.text("Cotisations salariales (total)", 40, doc.y, { continued: true, width: 300 });
      doc.text(fmt((payslip.gross_salary_total ?? 0) - (payslip.net_salary_total ?? 0)), 340, doc.y, { width: 150, align: "right" });
    }
    doc.moveDown(0.5);

    // ── Net social et IK ─────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica");
    const netRows: [string, string][] = [
      ["Salaire brut",                          fmt(payslip.gross_salary_total)],
      ["Net social (avant prélèvement source)", fmt(payslip.net_salary_total)],
      ["Indemnités kilométriques",              fmt(payslip.reimbursements_total)],
    ];
    for (const [label, value] of netRows) {
      doc.text(label, 40, doc.y, { continued: true, width: 300 });
      doc.text(value, 340, doc.y, { width: 150, align: "right" });
    }
    doc.moveDown(0.3);

    // ── Cotisations patronales (informatives) ─────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("COTISATIONS PATRONALES (à titre informatif)");
    doc.moveDown(0.2);
    if (patLines.length > 0) {
      const cColX = [40, 230, 315, 400];
      doc.fontSize(8).font("Helvetica-Bold");
      doc.text("Nature",   cColX[0], doc.y, { continued: true, width: 185 })
         .text("Base (€)", cColX[1], doc.y, { continued: true, width: 80, align: "right" })
         .text("Taux",     cColX[2], doc.y, { continued: true, width: 80, align: "right" })
         .text("Montant",  cColX[3], doc.y, { width: 100, align: "right" });
      doc.moveDown(0.1);
      doc.font("Helvetica");
      for (const r of patLines) {
        const y = doc.y;
        doc.text(r.label, cColX[0], y, { continued: true, width: 185 })
           .text(r.base != null ? r.base.toFixed(2) : "—", cColX[1], y, { continued: true, width: 80, align: "right" })
           .text(r.rate != null ? `${(r.rate * 100).toFixed(3)} %` : "—", cColX[2], y, { continued: true, width: 80, align: "right" })
           .text(fmt(r.amount), cColX[3], y, { width: 100, align: "right" });
      }
      const totalPat = patLines.reduce((s, r) => s + (r.amount ?? 0), 0);
      doc.moveDown(0.1);
      doc.font("Helvetica-Bold");
      doc.text("Total charges patronales nettes", cColX[0], doc.y, { continued: true, width: 355 })
         .text(fmt(totalPat), cColX[3], doc.y, { width: 100, align: "right" });
      doc.font("Helvetica");
    } else {
      doc.fontSize(9).font("Helvetica");
      doc.text("Cotisations patronales (total)", 40, doc.y, { continued: true, width: 300 });
      doc.text(fmt(payslip.employer_contribs_total), 340, doc.y, { width: 150, align: "right" });
    }

    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("NET À PAYER", 40, doc.y, { continued: true, width: 300 });
    doc.text(fmt(payslip.total_net), 340, doc.y, { width: 150, align: "right" });
    doc.moveDown(1);

    // ── Legal footer ──────────────────────────────────────────────────────
    doc.fontSize(7).font("Helvetica")
      .text(
        "Ce bulletin de paie est à conserver sans limitation de durée (article L3243-4 du Code du travail). " +
        "Les cotisations indiquées sont calculées automatiquement selon les taux en vigueur au 01/01/2026. " +
        "Ce bulletin est établi dans le cadre du service à la personne en mode mandataire (art. L7232-6 C. trav.) : " +
        "l'employeur légal est le particulier employeur ; " + mandataireNom + " intervient en qualité de mandataire gestionnaire uniquement.",
        { align: "justify" },
      );

    doc.end();
  });

  // ── 6. Upload to Supabase Storage ────────────────────────────────────────
  const filename = payslip.number ?? `payslip-${payslip.id}`;
  const path = `${payslip.period ?? "unknown"}/${filename}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("payslips")
    .upload(path, pdfBuffer, { upsert: true, contentType: "application/pdf" });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const pdfUrl = buildPublicStorageUrl("payslips", path) ?? `/api/billing/payslips/${payslipId}/pdf`;

  const { error } = await supabase
    .from("payslips")
    .update({ pdf_path: path, pdf_url: pdfUrl })
    .eq("id", payslipId);

  if (error) {
    throw new Error(error.message);
  }

  return pdfUrl;
}
