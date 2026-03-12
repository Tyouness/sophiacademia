export type VilleSeo = {
  slug: string;
  name: string;
  hook: string;
  focus: string;
};

export const villes06: VilleSeo[] = [
  {
    slug: "antibes",
    name: "Antibes",
    hook: "À Antibes, les familles recherchent souvent un accompagnement scolaire régulier après la classe.",
    focus: "cours particuliers à domicile, aide aux devoirs et préparation brevet / bac",
  },
  {
    slug: "valbonne",
    name: "Valbonne",
    hook: "À Valbonne, nous accompagnons des élèves du collège au lycée avec une approche structurée.",
    focus: "soutien scolaire en mathématiques, physique et français",
  },
  {
    slug: "sophia-antipolis",
    name: "Sophia Antipolis",
    hook: "À Sophia Antipolis, notre réseau d'étudiants et jeunes diplômés s'adapte aux emplois du temps exigeants.",
    focus: "professeur particulier qualifié et suivi pédagogique personnalisé",
  },
  {
    slug: "biot",
    name: "Biot",
    hook: "À Biot, nous privilégions un accompagnement progressif pour consolider les bases et redonner confiance.",
    focus: "aide aux devoirs et méthodologie durable",
  },
  {
    slug: "grasse",
    name: "Grasse",
    hook: "À Grasse, les besoins sont variés entre remise à niveau et préparation d'examens.",
    focus: "cours à domicile dans les matières scientifiques et littéraires",
  },
  {
    slug: "villeneuve-loubet",
    name: "Villeneuve-Loubet",
    hook: "À Villeneuve-Loubet, nous proposons des interventions proches du domicile pour limiter les contraintes logistiques.",
    focus: "soutien scolaire de proximité sur la Côte d'Azur",
  },
  {
    slug: "cagnes-sur-mer",
    name: "Cagnes-sur-Mer",
    hook: "À Cagnes-sur-Mer, nous mettons l'accent sur la régularité et l'autonomie de l'élève.",
    focus: "accompagnement scolaire hebdomadaire",
  },
  {
    slug: "nice",
    name: "Nice",
    hook: "À Nice, nous intervenons pour des profils très différents, du primaire aux classes à examen.",
    focus: "cours particuliers à domicile et préparation des échéances scolaires",
  },
  {
    slug: "juan-les-pins",
    name: "Juan-les-Pins",
    hook: "À Juan-les-Pins, nous accompagnons les élèves toute l'année avec des objectifs clairs et mesurables.",
    focus: "réussite scolaire et progression continue",
  },
  {
    slug: "cannes",
    name: "Cannes",
    hook: "À Cannes, nous proposons un suivi pédagogique structuré et un reporting transparent pour les familles.",
    focus: "cours à domicile 06 avec enseignants sélectionnés",
  },
  {
    slug: "le-cannet",
    name: "Le Cannet",
    hook: "Au Cannet, l'objectif est d'allier exigence académique et confiance de l'élève.",
    focus: "professeur particulier, révisions ciblées et méthode",
  },
  {
    slug: "alpes-maritimes",
    name: "Alpes-Maritimes",
    hook: "Dans les Alpes-Maritimes, nous couvrons les principales communes du 06 avec un service à domicile flexible.",
    focus: "cours particuliers 06 et service à la personne",
  },
];

export function getVilleSeo(slug: string) {
  return villes06.find((ville) => ville.slug === slug) ?? null;
}
