import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions SAP mandataire | Sophiacademia",
  description:
    "Conditions du modèle mandataire service à la personne appliqué aux cours particuliers à domicile avec Sophiacademia.",
  alternates: { canonical: "/conditions-sap-mandataire" },
};

export default function ConditionsSapMandatairePage() {
  return (
    <main>
      {/* HERO */}
      <section style={{ backgroundColor: "#1E3A5F" }} className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>Service à la personne</p>
          <h1 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}>
            Conditions SAP mandataire
          </h1>
          <div className="mt-3 h-[3px] w-10 rounded-full" style={{ backgroundColor: "#F59E0B" }} aria-hidden />
          <p className="mt-5 text-sm leading-7" style={{ color: "#94A3B8" }}>
            Dans le mode mandataire SAP, la famille est juridiquement l&apos;employeur de l&apos;intervenant.
            Sophiacademia agit en qualité de mandataire pour faciliter la mise en relation et la gestion opérationnelle.
          </p>
          {/* Badge crédit d'impôt */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <span style={{ color: "#F59E0B" }}>&#128176;</span>
            <span className="text-sm font-semibold" style={{ color: "#F59E0B" }}>Crédit d&apos;impôt 50 % — éligibilité immédiate</span>
          </div>
        </div>
      </section>

      {/* CONTENU */}
      <section style={{ backgroundColor: "#FAF7F2" }} className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-3xl space-y-10">

          {[
            {
              title: "Cadre général",
              body: "Sophiacademia opère en tant que mandataire service à la personne au sens de l'article L. 7232-6 du Code du travail. Dans ce cadre, la famille mandate Sophiacademia pour la mise en relation avec un professeur particulier et la gestion administrative associée.",
            },
            {
              title: "Rôles et responsabilités",
              body: "La famille est l'employeur du professeur. À ce titre, elle assume les responsabilités d'employeur prévues par la loi. Sophiacademia facilite la mise en relation, structure l'organisation des cours, gère la facturation et accompagne les démarches CESU/URSSAF.",
            },
            {
              title: "Crédit d'impôt",
              body: "Les familles ayant recours à des services à la personne bénéficient d'un crédit d'impôt de 50 % sur les dépenses engagées, dans la limite du plafond légal en vigueur. Sophiacademia fournit les attestations fiscales annuelles nécessaires.",
            },
            {
              title: "Périmètre d'accompagnement",
              body: "Sophiacademia intervient sur la sélection des profils, l'organisation des cours particuliers à domicile, le suivi pédagogique, l'émission des justificatifs et l'assistance administrative liée au cadre mandataire SAP.",
            },
            {
              title: "Obligations déclaratives",
              body: "Les parties s'engagent à respecter l'ensemble des obligations déclaratives, sociales et fiscales applicables. Les conditions peuvent évoluer en fonction de la réglementation nationale relative aux services à la personne.",
            },
            {
              title: "Transparence tarifaire",
              body: "Les tarifs sont communiqués clairement avant tout engagement. La facturation distingue la rémunération du professeur des frais de gestion Sophiacademia. Aucun frais caché n'est appliqué.",
            },
          ].map(({ title, body }) => (
            <article key={title} className="rounded-2xl p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <h2 className="text-base font-bold mb-1" style={{ color: "#0F172A" }}>{title}</h2>
              <div aria-hidden style={{ width: 24, height: 2, backgroundColor: "#F59E0B", borderRadius: 1, marginBottom: 12 }} />
              <p className="text-sm leading-7" style={{ color: "#334155" }}>{body}</p>
            </article>
          ))}

        </div>
      </section>
    </main>
  );
}
