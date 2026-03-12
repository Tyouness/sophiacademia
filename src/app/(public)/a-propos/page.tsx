import type { Metadata } from "next";
import Link from "next/link";
import SectionTitle from "@/components/public/SectionTitle";
import { patternBgStyle } from "@/components/public/ContinuousLightWrapper";

export const metadata: Metadata = {
  title: "À propos de Sophiacademia | Soutien scolaire local dans le 06",
  description:
    "Découvrez la philosophie Sophiacademia : un accompagnement scolaire local, humain et exigeant dans les Alpes-Maritimes avec des professeurs qualifiés.",
  alternates: { canonical: "/a-propos" },
};

export default function AproposPage() {
  return (
    <main>

      {/* HERO — navy */}
      <section style={{ backgroundColor: "#0F172A" }} className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>À propos</p>
          <h1
            className="text-4xl font-bold leading-tight md:text-5xl"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}
          >
            Un service scolaire local,<br />humain et exigeant
          </h1>
          <div className="mx-auto mt-4 h-[3px] w-10 rounded-full gold-line-animate" style={{ backgroundColor: "#F59E0B" }} aria-hidden />
          <p className="mt-6 text-base leading-8" style={{ color: "#94A3B8" }}>
            Sophiacademia est né d'un constat simple : les familles des Alpes-Maritimes méritent
            un accompagnement scolaire réactif, transparent et vraiment local.
          </p>
        </div>
      </section>

      {/* PILIERS — crème + motif */}
      <section style={{ backgroundColor: "#FAF7F2", ...patternBgStyle }} className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <SectionTitle eyebrow="Nos fondations" center>
              Ce qui nous définit
            </SectionTitle>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                icon: "📍",
                title: "Un ancrage territorial fort",
                text: "Nous sommes fortement implantés entre Antibes, Valbonne, Sophia Antipolis, Biot, Grasse et Nice, avec une couverture active de Villeneuve-Loubet, Cagnes-sur-Mer, Juan-les-Pins, Cannes et Le Cannet. Cette proximité permet des interventions rapides et un suivi durable.",
              },
              {
                icon: "🎓",
                title: "Un réseau pédagogique qualifié",
                text: "Notre réseau s'appuie sur des étudiants et jeunes diplômés issus de formations exigeantes : CPGE, écoles d'ingénieurs, masters sélectifs. Chaque professeur est sélectionné selon la matière, le niveau et les objectifs définis avec la famille.",
              },
              {
                icon: "🤝",
                title: "Un service humain et réactif",
                text: "Pas de plateforme froide, pas de chatbot. Un conseiller dédié comprend votre situation et vous propose un profil adapté sous 48h. Vous avez un interlocuteur réel, joignable et impliqué.",
              },
              {
                icon: "💶",
                title: "Une transparence totale",
                text: "Notre modèle mandataire SAP vous donne accès au crédit d'impôt de 50 %. Nous gérons tout l'administratif. Pas de frais cachés, pas de surprise — juste des cours efficaces.",
              },
            ].map(({ icon, title, text }) => (
              <article
                key={title}
                className="card-hover rounded-2xl p-6"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0" }}
              >
                <p className="text-2xl mb-3" style={{ opacity: 0.9 }}>{icon}</p>
                <h3 className="text-base font-bold mb-1" style={{ color: "#0F172A" }}>{title}</h3>
                <div aria-hidden style={{ width: 24, height: 2, backgroundColor: "#F59E0B", borderRadius: 1, marginBottom: 10 }} />
                <p className="text-sm leading-7" style={{ color: "#334155" }}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PHILOSOPHIE — royal blue */}
      <section style={{ backgroundColor: "#1E3A5F" }} className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-3xl">
          <SectionTitle eyebrow="Notre philosophie" light>
            Au-delà des exercices
          </SectionTitle>
          <p className="mt-8 text-sm leading-9" style={{ color: "#CBD5E1" }}>
            Nous croyons qu'un bon soutien scolaire ne se limite pas à faire les exercices.
            Il s'agit d'aider l'élève à mieux comprendre, à structurer sa méthode, à gagner
            en confiance et à devenir plus autonome — en maths, en physique, en français,
            comme dans la préparation des examens.
          </p>
          <p className="mt-5 text-sm leading-9" style={{ color: "#94A3B8" }}>
            Notre ambition : bâtir une référence locale des cours à domicile dans le 06,
            avec un service fiable, lisible et durable pour les familles de la Côte d'Azur.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/fonctionnement"
              className="rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "#CBD5E1" }}
            >
              Voir notre fonctionnement →
            </Link>
            <Link
              href="/contact"
              className="rounded-full px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
