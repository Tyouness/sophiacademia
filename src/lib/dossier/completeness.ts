/**
 * Dossier completeness helpers — URSSAF-5/12
 *
 * Pure functions that compute a completeness status for a professor (salarié)
 * or family (employeur) dossier.
 *
 * Status scale:
 *   "incomplete"    — critical fields are missing, dossier not usable
 *   "partial"       — most fields present, 1–2 non-critical fields missing
 *   "payroll_ready" — all required fields present
 *
 * Readiness levels (URSSAF-12):
 *   professorCompleteness()   — 6-field declarative check (backward compat)
 *   professorPayrollReadiness() — 8-field real check: validates ISO date,
 *                                  uses professor_profiles.addr1 canonical source,
 *                                  requires postcode + city for PDF generation
 */

// ── Date validation ───────────────────────────────────────────────────────────

/**
 * Returns true only for strings matching YYYY-MM-DD with plausible values.
 * Rejects empty, null, non-string, and non-ISO format.
 */
export function isValidIsoDate(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(s);
}

export type CompletenessStatus = "incomplete" | "partial" | "payroll_ready";

export type CompletenessResult = {
  status: CompletenessStatus;
  /** Human-readable list of missing field labels */
  missingFields: string[];
  /** 0–100 percentage of filled required fields */
  score: number;
};

type ProfessorDossierInput = {
  full_name?: string | null;
  birth_date?: string | null;
  addr1?: string | null;
  /** Pass true if nir_encrypted is non-null in DB — never pass raw encrypted value */
  hasNir?: boolean;
  /** Pass true if iban_encrypted is non-null in DB — never pass raw encrypted value */
  hasIban?: boolean;
  bic?: string | null;
};

type FamilyDossierInput = {
  rep_first?: string | null;
  rep_last?: string | null;
  rep_phone?: string | null;
  addr1?: string | null;
  fiscal_consent?: boolean | null;
  mandate_consent?: boolean | null;
  legal_notice_accepted?: boolean | null;
};

/** Required fields for a professor dossier to be payroll-ready */
const PROFESSOR_FIELDS: Array<{
  label: string;
  get: (d: ProfessorDossierInput) => boolean;
}> = [
  { label: "Nom complet", get: (d) => Boolean(d.full_name?.trim()) },
  { label: "Date de naissance", get: (d) => Boolean(d.birth_date) },
  { label: "Adresse", get: (d) => Boolean(d.addr1?.trim()) },
  { label: "NIR (numéro sécurité sociale)", get: (d) => Boolean(d.hasNir) },
  { label: "IBAN", get: (d) => Boolean(d.hasIban) },
  { label: "BIC", get: (d) => Boolean(d.bic?.trim()) },
];

/** Required fields for a family dossier to be payroll-ready */
const FAMILY_FIELDS: Array<{
  label: string;
  get: (d: FamilyDossierInput) => boolean;
}> = [
  { label: "Prénom représentant", get: (d) => Boolean(d.rep_first?.trim()) },
  { label: "Nom représentant", get: (d) => Boolean(d.rep_last?.trim()) },
  { label: "Téléphone", get: (d) => Boolean(d.rep_phone?.trim()) },
  { label: "Adresse", get: (d) => Boolean(d.addr1?.trim()) },
  { label: "Consentement fiscal", get: (d) => d.fiscal_consent === true },
  { label: "Consentement mandat SAP", get: (d) => d.mandate_consent === true },
  { label: "Mentions légales acceptées", get: (d) => d.legal_notice_accepted === true },
];

function computeResult<T>(
  fields: Array<{ label: string; get: (d: T) => boolean }>,
  data: T,
): CompletenessResult {
  const missing = fields.filter((f) => !f.get(data)).map((f) => f.label);
  const score = Math.round(
    ((fields.length - missing.length) / fields.length) * 100,
  );

  let status: CompletenessStatus;
  if (missing.length === 0) {
    status = "payroll_ready";
  } else if (missing.length <= 2) {
    status = "partial";
  } else {
    status = "incomplete";
  }

  return { status, missingFields: missing, score };
}

export function professorCompleteness(
  data: ProfessorDossierInput,
): CompletenessResult {
  return computeResult(PROFESSOR_FIELDS, data);
}

export function familyCompleteness(
  data: FamilyDossierInput,
): CompletenessResult {
  return computeResult(FAMILY_FIELDS, data);
}

// ── Readiness URSSAF / Avance Immédiate ─────────────────────────────────────────

/**
 * Statut de préparation du dossier employeur pour une future activation URSSAF.
 * Distinct de CompletenessStatus : l'étiquette "urssaf_ready" marque le seuil d'activation
 * URSSAF / Avance Immédiate, au-delà du seuil SAP/paie (payroll_ready).
 */
export type EmployerReadinessStatus = "incomplete" | "partial" | "urssaf_ready";

export type EmployerReadinessResult = {
  status: EmployerReadinessStatus;
  /** Human-readable list of missing field labels */
  missingFields: string[];
  /** 0–100 percentage of filled required fields */
  score: number;
};

export type EmployerReadinessInput = {
  // — Identité / contact représentant (subset of FamilyDossierInput) —
  rep_first?: string | null;
  rep_last?: string | null;
  rep_phone?: string | null;
  /**
   * Adresse postale du foyer — DOIT provenir de `family_profiles.addr1` uniquement.
   * Ne pas passer `profiles.addr1` en fallback : les deux routes `update-address`
   * synchronisent déjà `family_profiles` quand `role = 'family'`. Si ce champ est
   * null ici, le dossier URSSAF enverra une adresse vide ; l'indicateur doit refléter
   * cela plutôt que de masquer le manque.
   */
  addr1?: string | null;
  /**
   * Date de naissance du représentant légal (YYYY-MM-DD).
   * Requise par l'API URSSAF Avance Immédiate pour l’enregistrement de l’employeur.
   */
  birth_date?: string | null;
  // — Consentements —
  fiscal_consent?: boolean | null;
  mandate_consent?: boolean | null;
  legal_notice_accepted?: boolean | null;
  /**
   * Passer true si un numéro fiscal (SPI) est déjà renseigné dans urssaf_clients.
   * Ne jamais passer la valeur chiffrée brute.
   */
  hasFiscalNumber?: boolean;
};

/** 9 champs requis pour qu'un dossier famille soit URSSAF-ready */
const EMPLOYER_READINESS_FIELDS: Array<{
  label: string;
  get: (d: EmployerReadinessInput) => boolean;
}> = [
  { label: "Prénom représentant",          get: (d) => Boolean(d.rep_first?.trim()) },
  { label: "Nom représentant",             get: (d) => Boolean(d.rep_last?.trim()) },
  { label: "Téléphone",                    get: (d) => Boolean(d.rep_phone?.trim()) },
  { label: "Adresse",                      get: (d) => Boolean(d.addr1?.trim()) },
  // isValidIsoDate: rejects non-ISO strings like "abc" or "2500-99-99" (URSSAF-12)
  { label: "Date de naissance (représentant)", get: (d) => isValidIsoDate(d.birth_date) },
  { label: "Consentement fiscal",          get: (d) => d.fiscal_consent === true },
  { label: "Consentement mandat SAP",      get: (d) => d.mandate_consent === true },
  { label: "Mentions légales acceptées",  get: (d) => d.legal_notice_accepted === true },
  { label: "Numéro fiscal (SPI)",          get: (d) => Boolean(d.hasFiscalNumber) },
];

/**
 * Calcule si le dossier famille est prêt pour une future activation URSSAF / Avance Immédiate.
 *
 * Vérifie 9 champs (7 dossier famille + date de naissance + numéro fiscal SPI).
 *
 * Règles de statut :
 *  - "urssaf_ready" : 0 champ manquant
 *  - "partial"     : 1–2 champs manquants
 *  - "incomplete"  : 3+ champs manquants
 */
export function employerReadiness(
  data: EmployerReadinessInput,
): EmployerReadinessResult {
  const missing = EMPLOYER_READINESS_FIELDS.filter((f) => !f.get(data)).map(
    (f) => f.label,
  );
  const score = Math.round(
    ((EMPLOYER_READINESS_FIELDS.length - missing.length) /
      EMPLOYER_READINESS_FIELDS.length) *
      100,
  );

  let status: EmployerReadinessStatus;
  if (missing.length === 0) {
    status = "urssaf_ready";
  } else if (missing.length <= 2) {
    status = "partial";
  } else {
    status = "incomplete";
  }

  return { status, missingFields: missing, score };
}

// ── Readiness paie réelle (URSSAF-12) ────────────────────────────────────────

/**
 * Entrée pour la vérification de readiness réelle d'un dossier professeur.
 *
 * Différences avec ProfessorDossierInput :
 *  - addr1   : DOIT provenir de `professor_profiles.addr1` uniquement (source
 *              canonique pour le PDF de bulletin). Ne pas passer profiles.addr1
 *              en fallback — si professor_profiles.addr1 est null, l'adresse sur
 *              le PDF sera vide.
 *  - postcode / city : requis pour l'adresse complète sur le PDF de bulletin.
 *  - birth_date : validée comme date ISO YYYY-MM-DD (pas juste truthy).
 */
export type ProfessorPayrollReadinessInput = {
  full_name?: string | null;
  /** YYYY-MM-DD — validé comme ISO (isValidIsoDate). */
  birth_date?: string | null;
  /** Doit venir de professor_profiles.addr1 uniquement. */
  addr1?: string | null;
  postcode?: string | null;
  city?: string | null;
  /** Pass true if nir_encrypted is non-null in DB. */
  hasNir?: boolean;
  /** Pass true if iban_encrypted is non-null in DB. */
  hasIban?: boolean;
  bic?: string | null;
};

const PROFESSOR_PAYROLL_FIELDS: Array<{
  label: string;
  get: (d: ProfessorPayrollReadinessInput) => boolean;
}> = [
  { label: "Nom complet",                 get: (d) => Boolean(d.full_name?.trim()) },
  // birth_date validated as real ISO date — rejects truthy non-dates
  { label: "Date de naissance (ISO)",     get: (d) => isValidIsoDate(d.birth_date) },
  // addr1 from professor_profiles (canonical for payslip PDF) — NO profiles fallback
  { label: "Adresse (ligne 1)",           get: (d) => Boolean(d.addr1?.trim()) },
  { label: "Code postal",                 get: (d) => Boolean(d.postcode?.trim()) },
  { label: "Ville",                       get: (d) => Boolean(d.city?.trim()) },
  { label: "NIR (numéro sécurité sociale)", get: (d) => Boolean(d.hasNir) },
  { label: "IBAN",                        get: (d) => Boolean(d.hasIban) },
  { label: "BIC",                         get: (d) => Boolean(d.bic?.trim()) },
];

/**
 * Vérification de readiness réelle pour la paie/document professeur.
 *
 * Plus stricte que professorCompleteness() :
 *  - 8 champs au lieu de 6
 *  - birth_date validée comme ISO (pas juste truthy)
 *  - addr1 depuis professor_profiles (source canonique PDF)
 *  - postcode + city requis pour génération du PDF de bulletin
 *
 * Règles de statut :
 *  - "payroll_ready" : 0 champ manquant
 *  - "partial"       : 1–2 champs manquants
 *  - "incomplete"    : 3+ champs manquants
 */
export function professorPayrollReadiness(
  data: ProfessorPayrollReadinessInput,
): CompletenessResult {
  return computeResult(PROFESSOR_PAYROLL_FIELDS, data);
}
