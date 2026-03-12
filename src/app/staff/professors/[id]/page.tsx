import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { professorPayrollReadiness } from "@/lib/dossier/completeness";
import ProfessorDossierPanel from "./ProfessorDossierPanel";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProfessorDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabaseAdmin = createAdminSupabaseClient();

  const [{ data: profile }, { data: profProfile }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, email, phone, birth_date, addr1, addr2, postcode, city, country, created_at",
      )
      .eq("id", id)
      .eq("role", "professor")
      .single(),
    supabaseAdmin
      .from("professor_profiles")
      .select(
        "nir_encrypted, iban_encrypted, bic, gross_hourly_override, profession_type, profession_title, school_name, employer_name, job_title, employment_status, skills, addr1, addr2, postcode, city",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!profile) notFound();

  const hasNir = Boolean(profProfile?.nir_encrypted);
  const hasIban = Boolean(profProfile?.iban_encrypted);

  // URSSAF-12: use professorPayrollReadiness (real check) instead of
  // professorCompleteness. Key differences:
  //  - addr1 from professor_profiles ONLY (canonical source for payslip PDF)
  //  - birth_date validated as real ISO date
  //  - postcode + city required for complete PDF address
  const completeness = professorPayrollReadiness({
    full_name: profile.full_name,
    birth_date: profile.birth_date,
    // professor_profiles.addr1 is the canonical source used by PDF generation.
    // NO fallback to profiles.addr1 here: if professor_profiles.addr1 is null
    // the bulletin PDF will show an empty address — must be flagged.
    addr1: profProfile?.addr1 ?? null,
    postcode: profProfile?.postcode ?? null,
    city: profProfile?.city ?? null,
    hasNir,
    hasIban,
    bic: profProfile?.bic,
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

  return (
    <main className="space-y-6">
      {/* Back */}
      <div>
        <Link
          href="/staff/professors"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          ← Retour aux professeurs
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
        {/* Profile info */}
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Informations générales
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Téléphone</dt>
              <dd className="font-medium">{profile.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Date de naissance</dt>
              <dd className="font-medium">{profile.birth_date ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Adresse</dt>
              <dd className="font-medium text-right">
                {profile.addr1
                  ? `${profile.addr1}${profile.addr2 ? `, ${profile.addr2}` : ""}, ${profile.postcode} ${profile.city}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Statut professionnel</dt>
              <dd className="font-medium">
                {profProfile?.profession_title ?? profProfile?.profession_type ?? "—"}
              </dd>
            </div>
            {profProfile?.school_name && (
              <div className="flex justify-between">
                <dt className="text-gray-500">École</dt>
                <dd className="font-medium">{profProfile.school_name}</dd>
              </div>
            )}
            {profProfile?.employer_name && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Employeur principal</dt>
                <dd className="font-medium">{profProfile.employer_name}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Créé le</dt>
              <dd className="font-medium">
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString("fr-FR")
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">NIR</dt>
              <dd className="font-medium">
                {hasNir ? (
                  <span className="text-emerald-600">✓ renseigné</span>
                ) : (
                  <span className="text-rose-600">non renseigné</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">IBAN</dt>
              <dd className="font-medium">
                {hasIban ? (
                  <span className="text-emerald-600">✓ renseigné</span>
                ) : (
                  <span className="text-rose-600">non renseigné</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">BIC</dt>
              <dd className="font-medium">{profProfile?.bic ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Taux horaire brut</dt>
              <dd className="font-medium">
                {profProfile?.gross_hourly_override != null
                  ? `${Number(profProfile.gross_hourly_override).toFixed(2)} €/h`
                  : "Par défaut (15,00 €/h)"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Social form */}
        <div className="rounded-xl bg-white p-6 shadow-md">
          <ProfessorDossierPanel
            userId={id}
            birthDate={profile.birth_date ?? null}
            hasNir={hasNir}
            hasIban={hasIban}
            bic={profProfile?.bic ?? null}
            grossHourlyOverride={
              profProfile?.gross_hourly_override != null
                ? Number(profProfile.gross_hourly_override)
                : null
            }
          />
        </div>
      </div>
    </main>
  );
}
