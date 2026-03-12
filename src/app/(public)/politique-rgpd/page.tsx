import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique RGPD | Sophiacademia",
  description: "Politique de protection des données personnelles de Sophiacademia.",
  alternates: { canonical: "/politique-rgpd" },
};

export default function PolitiqueRgpdPage() {
  return (
    <main>
      {/* HERO */}
      <section style={{ backgroundColor: "#0F172A" }} className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>Confidentialité</p>
          <h1 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}>
            Politique de protection des données
          </h1>
          <div className="mt-3 h-[3px] w-10 rounded-full" style={{ backgroundColor: "#F59E0B" }} aria-hidden />
          <p className="mt-5 text-sm leading-7" style={{ color: "#94A3B8" }}>
            Conformément au Règlement Général sur la Protection des Données (RGPD) — Règlement UE 2016/679.
          </p>
        </div>
      </section>

      {/* CONTENU */}
      <section style={{ backgroundColor: "#FAF7F2" }} className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-3xl space-y-10">

          {[
            {
              title: "Données collectées",
              body: "Nous collectons uniquement les données nécessaires au traitement des demandes de cours particuliers et à la gestion des échanges : identité, coordonnées, informations pédagogiques utiles (niveau scolaire, objectifs, matières).",
            },
            {
              title: "Finalités du traitement",
              body: "Les données sont utilisées pour répondre aux demandes, organiser l'accompagnement scolaire, assurer le suivi opérationnel, émettre les factures et justificatifs SAP, et respecter nos obligations légales et comptables.",
            },
            {
              title: "Durée de conservation",
              body: "Les données sont conservées pendant une durée proportionnée aux finalités poursuivies. Les données comptables sont conservées 10 ans conformément aux obligations légales. Les données de contact sont supprimées sur demande ou après 3 ans d'inactivité.",
            },
            {
              title: "Vos droits",
              body: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition. Pour exercer vos droits : Younesstaleb10@gmail.com. Vous pouvez également saisir la CNIL (www.cnil.fr) en cas de litige.",
            },
            {
              title: "Sécurité",
              body: "Nous mettons en œuvre des mesures techniques adaptées : chiffrement TLS en transit, chiffrement au repos via Supabase, accès restreint par rôle (RLS), authentification sécurisée. Aucune donnée sensible n'est transmise à des tiers sans votre consentement.",
            },
            {
              title: "Cookies",
              body: "Ce site utilise uniquement des cookies strictement nécessaires au fonctionnement de la session utilisateur. Aucun cookie publicitaire ou de tracking tiers n'est utilisé.",
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
