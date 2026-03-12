import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getVilleSeo, villes06 } from "@/lib/seo/villes";

type VillePageProps = {
  params: Promise<{ ville: string }>;
};

export async function generateStaticParams() {
  return villes06.map((ville) => ({ ville: ville.slug }));
}

export async function generateMetadata({ params }: VillePageProps): Promise<Metadata> {
  const { ville } = await params;
  const data = getVilleSeo(ville);
  if (!data) {
    return { title: "Ville non trouvée | Sophiacademia" };
  }

  return {
    title: `Cours particuliers à ${data.name} | Sophiacademia`,
    description: `Cours particuliers à domicile à ${data.name} : soutien scolaire, aide aux devoirs, préparation brevet et bac avec accompagnement local dans les Alpes-Maritimes.`,
    alternates: { canonical: `/villes/${data.slug}` },
  };
}

export default async function VillePage({ params }: VillePageProps) {
  const { ville } = await params;
  const data = getVilleSeo(ville);
  if (!data) {
    notFound();
  }

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Cours particuliers à {data.name}</h1>
        <p className="mt-4 leading-7 text-slate-700">{data.hook}</p>
        <p className="mt-3 leading-7 text-slate-700">
          Sophiacademia propose des cours particuliers à domicile à {data.name} avec une logique de proximité et de régularité. Nous intervenons sur les matières clés (mathématiques, physique, français) ainsi que sur l'aide aux devoirs et les préparations d'examens.
        </p>
        <p className="mt-3 leading-7 text-slate-700">
          Notre ambition est de développer progressivement ce maillage local dans le 06 puis de l'étendre à d'autres régions de France, avec une architecture scalable orientée SEO sémantique et SEO local.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/contact" className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Demander un professeur à {data.name}</Link>
          <Link href="/" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800">Retour à l'accueil</Link>
        </div>
      </section>
    </main>
  );
}
