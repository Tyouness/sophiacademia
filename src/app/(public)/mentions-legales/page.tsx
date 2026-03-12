import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales | Sophiacademia",
  description: "Mentions légales du site Sophiacademia.",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  return (
    <main>
      {/* HERO */}
      <section style={{ backgroundColor: "#0F172A" }} className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>Légal</p>
          <h1 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}>
            Mentions légales
          </h1>
          <div className="mt-3 h-[3px] w-10 rounded-full" style={{ backgroundColor: "#F59E0B" }} aria-hidden />
        </div>
      </section>

      {/* CONTENU */}
      <section style={{ backgroundColor: "#FAF7F2" }} className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-3xl space-y-10">

          {[
            {
              title: "Éditeur du site",
              content: (
                <>
                  <p><strong style={{ color: "#0F172A" }}>Raison sociale :</strong> Sophiacademia</p>
                  <p><strong style={{ color: "#0F172A" }}>Contact :</strong> Younesstaleb10@gmail.com</p>
                  <p><strong style={{ color: "#0F172A" }}>Activité :</strong> Mise en relation pour cours particuliers à domicile et accompagnement scolaire dans les Alpes-Maritimes.</p>
                </>
              ),
            },
            {
              title: "Hébergement",
              content: (
                <p>Le site est hébergé sur une infrastructure cloud sécurisée adaptée aux applications web modernes. Les données applicatives sont stockées chez Supabase (base de données PostgreSQL) avec chiffrement en transit et au repos.</p>
              ),
            },
            {
              title: "Responsabilité",
              content: (
                <p>Les informations publiées sur ce site sont fournies à titre informatif. Sophiacademia met tout en œuvre pour assurer leur exactitude, sans garantir l’absence totale d’erreurs ou d’omissions. Sophiacademia ne saurait être tenu responsable d’un dommage résultant d’une utilisation incorrecte du service.</p>
              ),
            },
            {
              title: "Propriété intellectuelle",
              content: (
                <p>Les contenus, textes, logos et éléments visuels présents sur ce site sont protégés par le droit de la propriété intellectuelle. Toute reproduction, même partielle, sans autorisation préalable écrite de Sophiacademia est interdite.</p>
              ),
            },
          ].map(({ title, content }) => (
            <article key={title} className="rounded-2xl p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <h2 className="text-base font-bold mb-1" style={{ color: "#0F172A" }}>{title}</h2>
              <div aria-hidden style={{ width: 24, height: 2, backgroundColor: "#F59E0B", borderRadius: 1, marginBottom: 12 }} />
              <div className="text-sm leading-7 space-y-2" style={{ color: "#334155" }}>{content}</div>
            </article>
          ))}

        </div>
      </section>
    </main>
  );
}
