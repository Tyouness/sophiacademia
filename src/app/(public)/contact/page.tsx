import type { Metadata } from "next";
import ContactForm from "@/components/public/ContactForm";
import SectionTitle from "@/components/public/SectionTitle";
import { patternBgStyle } from "@/components/public/ContinuousLightWrapper";

export const metadata: Metadata = {
  title: "Contact | Cours particuliers à domicile 06 - Sophiacademia",
  description:
    "Contactez Sophiacademia pour un professeur particulier dans les Alpes-Maritimes : Antibes, Valbonne, Sophia Antipolis, Biot, Grasse, Nice, Cannes et alentours.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main>

      {/* HERO — navy */}
      <section style={{ backgroundColor: "#0F172A" }} className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>Contact</p>
          <h1
            className="text-4xl font-bold leading-tight md:text-5xl"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}
          >
            Parlons de votre enfant
          </h1>
          <div className="mx-auto mt-4 h-[3px] w-10 rounded-full gold-line-animate" style={{ backgroundColor: "#F59E0B" }} aria-hidden />
          <p className="mt-6 text-base leading-8" style={{ color: "#94A3B8" }}>
            Un conseiller vous répond sous 2h en semaine pour comprendre votre besoin
            et vous proposer un professeur adapté. Sans engagement.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm" style={{ color: "#64748B" }}>
            {["Antibes", "Valbonne", "Sophia Antipolis", "Biot", "Grasse", "Nice", "Cannes"].map((v) => (
              <span key={v} className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#94A3B8" }}>{v}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FORMULAIRE — crème + motif */}
      <section style={{ backgroundColor: "#FAF7F2", ...patternBgStyle }} className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <SectionTitle eyebrow="Votre demande" center>
              Un échange rapide pour cadrer votre besoin
            </SectionTitle>
            <p className="mt-5 text-sm leading-7" style={{ color: "#64748B" }}>
              Plus votre message est précis (niveau, matière, objectifs, fréquence, zone),
              plus nous répondons vite avec le bon profil.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>
    </main>
  );
}
