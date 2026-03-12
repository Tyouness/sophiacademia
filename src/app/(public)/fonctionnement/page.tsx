import type { Metadata } from "next";
import Link from "next/link";
import SectionTitle from "@/components/public/SectionTitle";
import { patternBgStyle } from "@/components/public/ContinuousLightWrapper";

export const metadata: Metadata = {
  title: "Fonctionnement des cours particuliers à domicile 06 | Sophiacademia",
  description:
    "Comprenez le fonctionnement Sophiacademia : mise en relation, suivi pédagogique, modèle mandataire SAP, cadre juridique et transparence des prix dans les Alpes-Maritimes.",
  alternates: { canonical: "/fonctionnement" },
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Accompagnement scolaire à domicile",
  provider: {
    "@type": "EducationalOrganization",
    name: "Sophiacademia",
  },
  areaServed: "Alpes-Maritimes",
  description:
    "Service de cours particuliers à domicile avec suivi pédagogique et cadre mandataire SAP.",
};

export default function FonctionnementPage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />

      {/* HERO — navy */}
      <section style={{ backgroundColor: "#0F172A" }} className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>Fonctionnement</p>
          <h1
            className="text-4xl font-bold leading-tight md:text-5xl"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}
          >
            Comment fonctionne Sophiacademia
          </h1>
          <div className="mx-auto mt-4 h-[3px] w-10 rounded-full gold-line-animate" style={{ backgroundColor: "#F59E0B" }} aria-hidden />
          <p className="mt-6 text-base leading-8" style={{ color: "#94A3B8" }}>
            Qualité pédagogique, proximité locale dans le 06 et transparence administrative.
            Du premier échange jusqu'au suivi régulier des cours.
          </p>
        </div>
      </section>

      {/* ÉTAPES — crème + motif */}
      <section style={{ backgroundColor: "#FAF7F2", ...patternBgStyle }} className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <SectionTitle eyebrow="Notre méthode" center>
              3 étapes simples et claires
            </SectionTitle>
            <p className="mt-5 text-base leading-7" style={{ color: "#64748B" }}>
              Un processus conçu pour aller vite, sans friction et sans surprise.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                num: "01",
                icon: "🎯",
                title: "Analyse du besoin",
                text: "Nous identifions les objectifs de l'élève : soutien scolaire, aide aux devoirs, préparation brevet ou bac, remise à niveau en maths, physique ou français.",
              },
              {
                num: "02",
                icon: "🤝",
                title: "Mise en relation ciblée",
                text: "Nous proposons un professeur dont le profil correspond au niveau, à la matière et au rythme attendu. Sélection sous 48h, entièrement prise en charge.",
              },
              {
                num: "03",
                icon: "📈",
                title: "Suivi de progression",
                text: "Compte-rendu après chaque séance, objectifs ajustés, progression mesurée. Vous savez exactement où en est votre enfant.",
              },
            ].map(({ num, icon, title, text }) => (
              <article
                key={num}
                className="card-hover rounded-2xl p-6"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0" }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}
                  >
                    {num}
                  </span>
                  <span className="text-2xl">{icon}</span>
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: "#0F172A" }}>{title}</h3>
                <div aria-hidden style={{ width: 24, height: 2, backgroundColor: "#F59E0B", borderRadius: 1, marginBottom: 10 }} />
                <p className="text-sm leading-7" style={{ color: "#334155" }}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SAP — royal blue */}
      <section style={{ backgroundColor: "#1E3A5F" }} className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10">
            <SectionTitle eyebrow="Cadre légal" light>
              Modèle mandataire SAP
            </SectionTitle>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-sm leading-8" style={{ color: "#CBD5E1" }}>
                Le modèle mandataire service à la personne (SAP) encadre juridiquement la relation et clarifie les responsabilités. Organisation des séances, obligations déclaratives, éligibilité au crédit d'impôt de 50 % — tout est transparent.
              </p>
              <p className="mt-4 text-sm leading-8" style={{ color: "#94A3B8" }}>
                Cette transparence est fondamentale pour construire une relation de confiance. Vous savez exactement ce qui est inclus et comment planifier les cours de façon fiable.
              </p>
            </div>
            <div className="grid gap-4">
              {[
                { icon: "⚖️", label: "Cadre juridique clair", sub: "Relation encadrée par le droit SAP" },
                { icon: "💶", label: "Crédit d'impôt 50 %", sub: "Éligibilité immédiate, gestion incluse" },
                { icon: "📋", label: "Aucune paperasse", sub: "Nous gérons l'administratif pour vous" },
              ].map(({ icon, label, sub }) => (
                <div
                  key={label}
                  className="flex items-center gap-4 rounded-xl p-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/conditions-sap-mandataire"
              className="rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "#CBD5E1" }}
            >
              Lire les conditions SAP →
            </Link>
            <Link
              href="/contact"
              className="rounded-full px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
            >
              Parler à notre équipe
            </Link>
          </div>
        </div>
      </section>

      {/* CTA final — navy */}
      <section style={{ background: "linear-gradient(135deg, #1E3A5F 0%, #0F172A 70%)" }} className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <SectionTitle eyebrow="Prêt à commencer ?" light center>
            Un professeur sélectionné sous 48h
          </SectionTitle>
          <p className="mt-6 text-sm leading-8" style={{ color: "#94A3B8" }}>
            Décrivez-nous votre besoin. Un conseiller vous rappelle sous 2h en semaine pour vous proposer le profil adapté.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/#rappel"
              className="rounded-full px-7 py-3.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
            >
              Demander un rappel gratuit
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
