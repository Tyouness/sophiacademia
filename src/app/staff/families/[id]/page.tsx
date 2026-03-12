import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { familyCompleteness, employerReadiness } from "@/lib/dossier/completeness";
import FamilyDossierPanel from "./FamilyDossierPanel";
import FamilyUrssafPanel from "./FamilyUrssafPanel";
import { runPreliveChecks } from "@/lib/prelive/runner";

type PageProps = { params: Promise<{ id: string }> };

export default async function FamilyDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabaseAdmin = createAdminSupabaseClient();

  const [{ data: profile }, { data: familyProfile }, { data: children }, { data: urssafClient }, preliveSummary] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, email, phone, birth_date, addr1, addr2, postcode, city, country, created_at",
        )
        .eq("id", id)
        .eq("role", "family")
        .single(),
      supabaseAdmin
        .from("family_profiles")
        .select(
          "rep_first, rep_last, rep_phone, addr1, addr2, postcode, city, country, fiscal_consent, mandate_consent, legal_notice_accepted, urssaf_consent_at, level, subjects, freq, duration, periods",
        )
        .eq("id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("family_children")
        .select("id, first_name, last_name, level, subjects")
        .eq("family_id", id)
        .order("first_name"),
      supabaseAdmin
        .from("urssaf_clients")
        .select("id, status, urssaf_customer_id, fiscal_number, registered_at, last_error")
        .eq("family_id", id)
        .maybeSingle(),
      runPreliveChecks(),
    ]);

  if (!profile) notFound();

  const completeness = familyCompleteness({
    rep_first: familyProfile?.rep_first,
    rep_last: familyProfile?.rep_last,
    rep_phone: familyProfile?.rep_phone ?? profile.phone,
    addr1: familyProfile?.addr1 ?? profile.addr1,
    fiscal_consent: familyProfile?.fiscal_consent,
    mandate_consent: familyProfile?.mandate_consent,
    legal_notice_accepted: familyProfile?.legal_notice_accepted,
  });

  const readiness = employerReadiness({
    rep_first: familyProfile?.rep_first,
    rep_last: familyProfile?.rep_last,
    // rep_phone: family_profiles is the editable source; register-client does rep_phone ?? profiles.phone
    rep_phone: familyProfile?.rep_phone ?? profile.phone,
    // addr1: strictly family_profiles.addr1 — NO fallback to profiles.addr1.
    // Both update-address routes sync family_profiles when role=family, so if family_profiles.addr1
    // is null, it means the address form has never been saved, and URSSAF would receive an empty
    // address. The dossier must show the field as missing in that case.
    addr1: familyProfile?.addr1,
    birth_date: profile.birth_date,
    fiscal_consent: familyProfile?.fiscal_consent,
    mandate_consent: familyProfile?.mandate_consent,
    legal_notice_accepted: familyProfile?.legal_notice_accepted,
    hasFiscalNumber: Boolean(urssafClient?.fiscal_number),
  });

  const statusColor: Record<string, string> = {
    payroll_ready: "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    incomplete: "bg-rose-100 text-rose-800",
  };
  const statusLabel: Record<string, string> = {
    payroll_ready: "Dossier exploitable",
    partial: "Dossier partiel",
    incomplete: "Dossier incomplet",
  };
  const readinessColor: Record<string, string> = {
    urssaf_ready: "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    incomplete: "bg-rose-100 text-rose-800",
  };
  const readinessLabel: Record<string, string> = {
    urssaf_ready: "Prêt pour URSSAF",
    partial: "Partiellement prêt",
    incomplete: "Incomplet",
  };

  return (
    <main className="space-y-6">
      {/* Back */}
      <div>
        <Link
          href="/staff/families"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          ← Retour aux familles
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {profile.full_name ?? "—"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{profile.email ?? "—"}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[completeness.status]}`}
          >
            {statusLabel[completeness.status]} — {completeness.score}%
          </span>
        </div>

        {completeness.missingFields.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            <p className="font-semibold">Champs manquants :</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {completeness.missingFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informations générales */}
        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-md">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Représentant légal
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Prénom</dt>
                <dd className="font-medium">{familyProfile?.rep_first ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Nom</dt>
                <dd className="font-medium">{familyProfile?.rep_last ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Téléphone</dt>
                <dd className="font-medium">
                  {familyProfile?.rep_phone ?? profile.phone ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Adresse</dt>
                <dd className="font-medium text-right">
                  {familyProfile?.addr1
                    ? `${familyProfile.addr1}${familyProfile.addr2 ? `, ${familyProfile.addr2}` : ""}, ${familyProfile.postcode} ${familyProfile.city}`
                    : profile.addr1
                      ? `${profile.addr1}, ${profile.postcode} ${profile.city}`
                      : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Créé le</dt>
                <dd className="font-medium">
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString("fr-FR")
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Consentements read-only */}
          <div className="rounded-xl bg-white p-6 shadow-md">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Consentements
            </h3>
            <dl className="space-y-2 text-sm">
              {[
                {
                  label: "Consentement fiscal",
                  value: familyProfile?.fiscal_consent,
                },
                {
                  label: "Mandat SAP",
                  value: familyProfile?.mandate_consent,
                },
                {
                  label: "Mentions légales",
                  value: familyProfile?.legal_notice_accepted,
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-gray-500">{label}</dt>
                  <dd
                    className={`font-semibold ${value ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {value ? "✓ Oui" : "✗ Non"}
                  </dd>
                </div>
              ))}
              {familyProfile?.urssaf_consent_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Consentement URSSAF le</dt>
                  <dd className="font-medium">
                    {new Date(familyProfile.urssaf_consent_at).toLocaleDateString(
                      "fr-FR",
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Children */}
          {children && children.length > 0 && (
            <div className="rounded-xl bg-white p-6 shadow-md">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">
                Enfants ({children.length})
              </h3>
              <ul className="space-y-2 text-sm">
                {children.map((child) => (
                  <li
                    key={child.id}
                    className="rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span className="font-medium">
                      {child.first_name} {child.last_name}
                    </span>
                    <span className="ml-2 text-gray-500">— {child.level}</span>
                    {Array.isArray(child.subjects) &&
                      child.subjects.length > 0 && (
                        <span className="ml-2 text-gray-400 text-xs">
                          ({(child.subjects as string[]).join(", ")})
                        </span>
                      )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Dossier edit form */}
        <div className="rounded-xl bg-white p-6 shadow-md">
          <FamilyDossierPanel
            userId={id}
            repFirst={familyProfile?.rep_first ?? null}
            repLast={familyProfile?.rep_last ?? null}
            repPhone={familyProfile?.rep_phone ?? profile.phone ?? null}
            fiscalConsent={familyProfile?.fiscal_consent ?? false}
            mandateConsent={familyProfile?.mandate_consent ?? false}
            legalNoticeAccepted={familyProfile?.legal_notice_accepted ?? false}
          />
        </div>

        {/* URSSAF readiness card */}
        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Préparation URSSAF / Avance Immédiate
            </h3>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                readinessColor[readiness.status]
              }`}
            >
              {readinessLabel[readiness.status]} — {readiness.score}%
            </span>
          </div>

          {readiness.missingFields.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              <p className="font-semibold">Champs manquants pour activation URSSAF :</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {readiness.missingFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <FamilyUrssafPanel
            userId={id}
            birthDate={profile.birth_date ?? null}
            hasFiscalNumber={Boolean(urssafClient?.fiscal_number)}
            urssafStatus={urssafClient?.status ?? null}
            urssafCustomerId={urssafClient?.urssaf_customer_id ?? null}
            registeredAt={urssafClient?.registered_at ?? null}
            lastError={urssafClient?.last_error ?? null}
            readinessStatus={readiness.status}
            preliveBlocked={preliveSummary.globalStatus === "blocked"}
          />
        </div>
      </div>
    </main>
  );
}
