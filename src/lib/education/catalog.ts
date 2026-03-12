export const SUBJECTS = [
  "Maths",
  "Physique",
  "Physique-Chimie",
  "Chimie",
  "SVT",
  "Francais",
  "Anglais",
  "Espagnol",
  "Allemand",
  "Histoire-Geographie",
  "SES",
  "Philosophie",
  "Informatique",
];

export const LEVELS = [
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "6e",
  "5e",
  "4e",
  "3e",
  "Seconde",
  "Premiere",
  "Terminale",
  "Superieur",
];

const levelRankMap: Record<string, number> = {
  cp: 0,
  ce1: 1,
  ce2: 2,
  cm1: 3,
  cm2: 4,
  "6e": 5,
  "6eme": 5,
  "5e": 6,
  "5eme": 6,
  "4e": 7,
  "4eme": 7,
  "3e": 8,
  "3eme": 8,
  seconde: 9,
  "2nde": 9,
  "2de": 9,
  premiere: 10,
  "1ere": 10,
  "1re": 10,
  terminale: 11,
  terminal: 11,
  superieur: 12,
};

export function levelRank(level: string | null | undefined) {
  if (!level) {
    return 99;
  }
  const normalized = level
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "")
    .replace(/\.+/g, "");
  return levelRankMap[normalized] ?? 99;
}
