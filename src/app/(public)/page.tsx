import type { Metadata } from "next";
import Link from "next/link";
import RappelForm from "@/components/public/RappelForm";
import ContinuousLightWrapper, { patternBgStyle } from "@/components/public/ContinuousLightWrapper";
import SectionTitle from "@/components/public/SectionTitle";

export const metadata: Metadata = {
  title:
    "Cours particuliers à domicile dans le 06 | Antibes, Valbonne, Sophia Antipolis — Sophiacademia",
  description:
    "Sophiacademia propose des cours particuliers à domicile dans les Alpes-Maritimes : Antibes, Valbonne, Sophia Antipolis, Biot, Grasse, Nice, Cannes. Sélection sous 48h · Crédit d'impôt 50 %.",
  alternates: { canonical: "/" },
};

const faqs = [
  {
    question: "Dans quelles villes intervenez-vous pour les cours particuliers ?",
    answer:
      "Nous intervenons principalement à Antibes, Valbonne, Sophia Antipolis, Biot, Grasse, Villeneuve-Loubet, Cagnes-sur-Mer, Nice, Juan-les-Pins, Cannes et Le Cannet.",
  },
  {
    question: "Quelles matières propose Sophiacademia ?",
    answer:
      "Mathématiques, physique-chimie, français, anglais, aide aux devoirs, préparation brevet et bac. Tous niveaux, du CM2 à la terminale.",
  },
  {
    question: "Le crédit d'impôt de 50 % est-il applicable ?",
    answer:
      "Oui. Dans le cadre du service à la personne en mode mandataire SAP, les familles bénéficient d'un crédit d'impôt immédiat de 50 % sur le coût réel des séances.",
  },
  {
    question: "Combien de temps pour trouver un professeur ?",
    answer:
      "Nous vous proposons un profil sous 48h maximum. Notre réseau de professeurs issus des grandes écoles de Sophia Antipolis nous permet d'intervenir très rapidement.",
  },
];

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "EducationalOrganization"],
  name: "Sophiacademia",
  areaServed: ["Antibes","Valbonne","Sophia Antipolis","Biot","Grasse","Villeneuve-Loubet","Cagnes-sur-Mer","Nice","Juan-les-Pins","Cannes","Le Cannet","Alpes-Maritimes"],
  url: "https://www.sophiacademia.fr",
  telephone: "+33 6 00 00 00 00",
  address: { "@type": "PostalAddress", addressRegion: "Alpes-Maritimes", postalCode: "06", addressCountry: "FR" },
};
const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Cours particuliers à domicile",
  provider: { "@type": "EducationalOrganization", name: "Sophiacademia" },
  areaServed: "Alpes-Maritimes",
  audience: { "@type": "EducationalAudience", educationalRole: "student" },
};
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

const professors = [
  {
    name: "Lucas M.",
    school: "EURECOM Sophia Antipolis",
    subjects: "Maths",
    subjectsExtra: "Physique",
    quote: "Je veux que mes élèves comprennent vraiment, pas qu'ils mémorisent des formules.",
    sessions: 84,
    emoji: "🧑‍💻",
    bio: "Ingénieur data en alternance, pédagogie claire et progression mesurée cours après cours.",
  },
  {
    name: "Camille R.",
    school: "Polytechnique Nice-Sophia",
    subjects: "Français",
    subjectsExtra: "Anglais",
    quote: "La confiance à l'écrit, ça se construit avec les bons outils et beaucoup de pratique.",
    sessions: 62,
    emoji: "👩‍🏫",
    bio: "Passionnée de littérature, elle aide à structurer les écrits et à progresser en expression orale.",
  },
  {
    name: "Thomas K.",
    school: "CentraleSupélec",
    subjects: "Maths",
    subjectsExtra: "Algo",
    quote: "Un bon prof trouve toujours l'angle qui fait tout comprendre d'un coup.",
    sessions: 107,
    emoji: "🧑‍🔬",
    bio: "Doctorant, spécialiste en déconstruction de problèmes complexes pour lycéens exigeants.",
  },
];

const testimonials = [
  { name: "Marie-Claire D.", city: "Antibes", rating: 5, text: "Mon fils est passé de 8 à 15 en maths en deux mois. Lucas est patient, structuré et vraiment pédagogue." },
  { name: "Stéphane V.", city: "Valbonne", rating: 5, text: "Service réactif, professeur trouvé en 24h. La qualité des cours est au rendez-vous, et le crédit d'impôt simplifie tout." },
  { name: "Nathalie G.", city: "Sophia Antipolis", rating: 5, text: "Camille a transformé le rapport de ma fille à la lecture. Elle a eu 17 au bac de français. Merci !" },
];

export default function PublicHomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* 1. HERO */}
      <section style={{ backgroundColor: "#0F172A" }} className="px-6 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest mb-5"
              style={{ backgroundColor: "#1E3A5F", color: "#F59E0B" }}
            >
              Alpes-Maritimes (06)
            </span>
            <h1
              className="text-4xl font-bold leading-tight md:text-5xl xl:text-6xl"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}
            >
              Le soutien scolaire{" "}
              <span className="h1-keyword" style={{ color: "#F59E0B" }}>
                humain et local
              </span>{" "}
              de Sophia
            </h1>
            <p className="mt-5 text-base leading-8 md:text-lg" style={{ color: "#94A3B8" }}>
              Des professeurs issus des grandes écoles de Sophia Antipolis,{" "}
              sélectionnés sous 48h, qui se déplacent chez vous à Antibes,
              Valbonne, Nice, Cannes et alentours.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm" style={{ color: "#CBD5E1" }}>
              {[
                "Professeur proposé sous 48h",
                "Crédit d'impôt 50 % immédiat (SAP mandataire)",
                "Présence locale dans tout le 06",
                "Suivi pédagogique structuré",
              ].map((point) => (
                <li key={point} className="flex items-center gap-2.5">
                  <span className="flex-shrink-0 text-base" style={{ color: "#F59E0B" }}>✓</span>
                  {point}
                </li>
              ))}
            </ul>
            {/* Badge preuve sociale héro */}
            <div
              className="mt-6 inline-flex items-center gap-4 rounded-2xl px-5 py-3"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div>
                <p className="text-2xl font-bold" style={{ color: "#F59E0B", fontFamily: "var(--font-fraunces), Georgia, serif" }}>
                  4,9<span className="text-sm font-normal">/5</span>
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "#475569" }}>Note moyenne</p>
              </div>
              <div className="w-px h-8" style={{ backgroundColor: "#1E3A5F" }} />
              <div>
                <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>+120</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#475569" }}>Familles suivies</p>
              </div>
              <div className="w-px h-8" style={{ backgroundColor: "#1E3A5F" }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: "#059669" }}>✓ SAP agréé</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#475569" }}>Officiel</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/#rappel"
                className="rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
              >
                Être rappelé gratuitement
              </Link>
              <Link
                href="/fonctionnement"
                className="rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
                style={{ borderColor: "#334155", color: "#94A3B8" }}
              >
                Comment ça marche →
              </Link>
            </div>
          </div>

          {/* Photo placeholder */}
          <div className="relative">
            <div
              className="aspect-[4/3] w-full rounded-3xl flex items-center justify-center"
              style={{ backgroundColor: "#1E3A5F", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-center px-6">
                <p className="text-5xl mb-3">👩‍🏫</p>
                <p className="text-sm font-medium" style={{ color: "#F59E0B" }}>Photo réelle à venir</p>
                <p className="text-xs mt-1" style={{ color: "#475569" }}>Professeur + élève à domicile</p>
              </div>
            </div>
            <div
              className="absolute -bottom-5 -left-5 rounded-2xl px-4 py-3 shadow-xl"
              style={{ backgroundColor: "#059669", color: "#FFFFFF" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Crédit d&apos;impôt</p>
              <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>50 %</p>
            </div>
          </div>
        </div>
      </section>

      {/* GROUPE CLAIR 1 — Preuves + Différenciation (pattern continu) */}
      <ContinuousLightWrapper>
      {/* 2. PREUVES */}
      <section style={{ backgroundColor: "#FFFFFF", ...patternBgStyle }}>
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { stat: "48h", label: "Professeur sélectionné", sub: "Maximum" },
              { stat: "50 %", label: "Crédit d'impôt", sub: "SAP mandataire" },
              { stat: "+30", label: "Profs actifs", sub: "Grandes écoles Sophia" },
              { stat: "100 %", label: "Suivi personnalisé", sub: "Objectifs mesurés" },
            ].map(({ stat, label, sub }) => (
              <div
                key={stat}
                className="rounded-2xl p-6 text-center"
                style={{ backgroundColor: "#FAF7F2", border: "1px solid #E2E8F0" }}
              >
                <p
                  className="text-3xl font-bold md:text-4xl"
                  style={{ color: "#F59E0B", fontFamily: "var(--font-fraunces), Georgia, serif" }}
                >
                  {stat}
                </p>
                <p className="mt-1.5 text-sm font-semibold" style={{ color: "#1E3A5F" }}>{label}</p>
                <p className="mt-0.5 text-xs" style={{ color: "#64748B" }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. DIFFÉRENCIATION */}
      <section style={{ backgroundColor: "#FAF7F2", position: "relative" }}>
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="max-w-3xl mx-auto text-center mb-14">
            <SectionTitle eyebrow="Notre différence" center>
              Pourquoi nous ne sommes pas un grand groupe national
            </SectionTitle>
            <p className="mt-5 text-base leading-8" style={{ color: "#64748B" }}>
              Là où les grandes enseignes standardisent, nous personnalisons.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: "📍", title: "Vraiment local", text: "Nos professeurs habitent et travaillent dans le 06. Ils connaissent les établissements, les programmes locaux, et se déplacent rapidement chez vous." },
              { icon: "🎓", title: "Parcours académiques exigeants", text: "Nous recrutons des étudiants et jeunes diplômés issus de formations sélectives : CPGE, écoles d'ingénieurs (EURECOM, Polytech Nice-Sophia, CentraleSupélec…), universités et masters présents à Sophia Antipolis." },
              { icon: "🤝", title: "Un conseiller humain", text: "Pas de chatbot, pas de plateforme froide. Un conseiller dédié vous répond, comprend votre situation et vous propose un profil adapté sous 48h." },
              { icon: "📊", title: "Suivi structuré", text: "Compte-rendu après chaque séance, objectifs clairs, progression mesurée. Vous savez exactement où en est votre enfant." },
              { icon: "💶", title: "Crédit d'impôt immédiat", text: "Nous gérons tout l'administratif SAP pour vous. Pas de paperasse complexe — le crédit d'impôt de 50 % est direct et transparent." },
              { icon: "⚡", title: "Réactivité garantie", text: "Une demande le lundi, un professeur le mercredi. Notre taille humaine nous permet d'agir vite là où les grands groupes prennent des semaines." },
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
        {/* Fondu bas → prépare visuellement la transition vers la section Professeurs */}
        <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, transparent, rgba(30,58,95,0.07))", pointerEvents: "none" }} />
      </section>
      </ContinuousLightWrapper>

      {/* 4. PROFESSEURS — bleu royal, pas de pattern */}
      <section style={{ backgroundColor: "#1E3A5F" }} className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <SectionTitle eyebrow="Nos professeurs" light center>
              Des profils d&apos;exception, humains avant tout
            </SectionTitle>
            <p className="mt-5 text-sm leading-7" style={{ color: "#94A3B8" }}>
              Chaque professeur est sélectionné sur ses compétences académiques et sa capacité à transmettre avec bienveillance.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {professors.map((prof) => (
              <article
                key={prof.name}
                className="card-hover rounded-2xl p-6 flex flex-col"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderLeft: "3px solid #F59E0B",
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "2px solid rgba(245,158,11,0.3)" }}
                  >
                    {prof.emoji}
                  </div>
                  <div>
                    <p className="font-bold text-white text-base">{prof.name}</p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>{prof.school}</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-4">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
                  >
                    {prof.subjects}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#CBD5E1" }}
                  >
                    {prof.subjectsExtra}
                  </span>
                </div>
                <blockquote
                  className="text-sm leading-7 italic mb-4 flex-1"
                  style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#CBD5E1" }}
                >
                  &ldquo;{prof.quote}&rdquo;
                </blockquote>
                <p className="text-xs leading-5 mb-4" style={{ color: "#64748B" }}>{prof.bio}</p>
                <div
                  className="flex items-center justify-between pt-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="text-xs" style={{ color: "#F59E0B" }}>★★★★★</span>
                  <span className="text-xs" style={{ color: "#475569" }}>{prof.sessions} séances</span>
                </div>
              </article>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/a-propos"
              className="inline-block rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "#CBD5E1" }}
            >
              Voir tous nos professeurs →
            </Link>
          </div>
        </div>
      </section>

      {/* GROUPE CLAIR 2 — Témoignages + FAQ (pattern continu) */}
      <ContinuousLightWrapper>
      {/* 5. TÉMOIGNAGES */}
      <section style={{ backgroundColor: "#FFFFFF", ...patternBgStyle }}>
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="text-center mb-14">
            <SectionTitle eyebrow="Témoignages" center>
              Ce que disent les familles
            </SectionTitle>
            <div
              className="mt-6 inline-flex items-center gap-3 rounded-full px-5 py-2.5"
              style={{ backgroundColor: "#FAF7F2", border: "1px solid #E2E8F0" }}
            >
              <span className="text-amber-400 text-sm">★★★★★</span>
              <span className="text-sm font-bold" style={{ color: "#0F172A" }}>4,9/5</span>
              <span className="text-xs" style={{ color: "#64748B" }}>· +87 avis · Alpes-Maritimes</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
              >
                Vérifié
              </span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <article
                key={t.name}
                className="card-hover rounded-2xl p-6"
                style={{ backgroundColor: "#FAF7F2", border: "1px solid #E2E8F0" }}
              >
                <p className="text-amber-400 text-sm mb-3">{"★".repeat(t.rating)}</p>
                <p
                  className="text-sm leading-7 italic mb-4"
                  style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#334155" }}
                >
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "#0F172A" }}>{t.name}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>{t.city}</p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ color: "#059669", border: "1px solid rgba(5,150,105,0.25)" }}
                  >
                    ✓ Vérifié
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section style={{ backgroundColor: "#FAF7F2" }}>
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-24">
          <div className="text-center mb-10">
            <SectionTitle center>Questions fréquentes</SectionTitle>
          </div>
          <div className="space-y-5">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-2xl p-6"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0" }}
              >
                <h3 className="font-bold text-base mb-2" style={{ color: "#0F172A" }}>{faq.question}</h3>
                <p className="text-sm leading-7" style={{ color: "#334155" }}>{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      </ContinuousLightWrapper>

      {/* 7. RAPPEL — dégradé sombre, pas de pattern */}
      <section
        id="rappel"
        style={{ background: "linear-gradient(135deg, #1E3A5F 0%, #0F172A 60%, #1a1a0e 100%)" }}
        className="px-6 py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl grid gap-12 md:grid-cols-2 items-center">
          <div>
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest mb-5"
              style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
            >
              Rappel gratuit
            </span>
            <SectionTitle light>Parlez-nous de votre enfant.</SectionTitle>
            <p className="text-sm leading-8 mt-5 mb-6" style={{ color: "#94A3B8" }}>
              Un conseiller vous rappelle sous 2h en semaine pour comprendre votre besoin,{" "}
              répondre à vos questions et vous proposer un professeur adapté.
              Sans engagement, sans frais d&apos;inscription.
            </p>
            <ul className="space-y-2 text-sm" style={{ color: "#64748B" }}>
              <li className="flex items-center gap-2"><span style={{ color: "#059669" }}>✓</span> Appel humain (pas un standard automatique)</li>
              <li className="flex items-center gap-2"><span style={{ color: "#059669" }}>✓</span> Professeur proposé sous 48h si accord</li>
              <li className="flex items-center gap-2"><span style={{ color: "#059669" }}>✓</span> Crédit d&apos;impôt 50 % expliqué simplement</li>
            </ul>
          </div>
          <div
            className="rounded-2xl p-7"
            style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <RappelForm />
          </div>
        </div>
      </section>
    </>
  );
}
