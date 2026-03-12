import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CGU | Sophiacademia",
  description: "Conditions générales d'utilisation de Sophiacademia.",
  alternates: { canonical: "/cgu" },
};

export default function CguPage() {
  return (
    <main>
      {/* HERO */}
      <section style={{ backgroundColor: "#0F172A" }} className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>Légal</p>
          <h1 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}>
            Conditions générales d&apos;utilisation
          </h1>
          <div className="mt-3 h-[3px] w-10 rounded-full" style={{ backgroundColor: "#F59E0B" }} aria-hidden />
        </div>
      </section>

      {/* CONTENU */}
      <section style={{ backgroundColor: "#FAF7F2" }} className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-3xl space-y-10">

          {[
            {
              title: "Objet",
              body: "Les présentes CGU encadrent l’utilisation du site Sophiacademia et des services d’information liés aux cours particuliers à domicile dans les Alpes-Maritimes.",
            },
            {
              title: "Accès au service",
              body: "L’accès au site est gratuit. Certaines fonctionnalités (espace famille, espace professeur) nécessitent la création d’un compte et la validation d’informations complémentaires par notre équipe.",
            },
            {
              title: "Responsabilités de l’utilisateur",
              body: "L’utilisateur s’engage à fournir des informations exactes et à ne pas utiliser le service à des fins contraires à la loi. Sophiacademia agit avec diligence mais ne peut être tenu responsable d’un mauvais usage du service ou d’informations erronées fournies par des tiers.",
            },
            {
              title: "Propriété intellectuelle",
              body: "Les contenus, textes, logos et éléments visuels présents sur le site sont protégés par le droit de la propriété intellectuelle. Toute reproduction sans autorisation préalable est interdite.",
            },
            {
              title: "Modification des CGU",
              body: "Sophiacademia se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés des modifications significatives. L’utilisation continue du service vaut acceptation des CGU mises à jour.",
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
