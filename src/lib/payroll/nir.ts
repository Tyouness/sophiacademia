/**
 * NIR (Numéro d'Inscription au Répertoire) — French social security number.
 *
 * Format: 15 digits
 *   [1]   sex: 1 = male, 2 = female
 *   [2-3] year of birth (YY)
 *   [4-5] month of birth (01-12, or 20 for unknown)
 *   [6-7] department (01-95 + 2A/2B mapped → 19/18 for key calc, 96-99 for overseas)
 *   [8-10] commune code (001-999)
 *   [11-13] order number within commune-birth-month (001-999)
 *   [14-15] key = 97 − (first 13 digits mod 97), zero-padded to 2 digits
 *
 * Note: Corsican departments 2A/2B are special cases.
 * For key validation we use the simplified algorithm that treats the 13-digit
 * base as an integer (works for 01-95 and 97-99; Corsica requires substitution).
 */

/** Validates the format and key of a NIR string (15 digits). */
export function validateNir(nir: string): { valid: boolean; error?: string } {
  const trimmed = nir.trim();

  // Must be exactly 15 digits (no spaces, no dashes)
  if (!/^[0-9]{15}$/.test(trimmed)) {
    return { valid: false, error: "nir_format_invalid" };
  }

  // First digit: 1 (male) or 2 (female)
  const sex = trimmed[0];
  if (sex !== "1" && sex !== "2") {
    return { valid: false, error: "nir_sex_invalid" };
  }

  // Key check: 97 − (base[0..12] mod 97) should equal digits [13..14]
  // Corsica (dept 2A → 19, dept 2B → 18) is not handled here; format check still passes.
  const base = trimmed.slice(0, 13);
  const keyExpected = 97 - (Number(base) % 97);
  const keyActual = Number(trimmed.slice(13, 15));

  if (keyExpected !== keyActual) {
    return { valid: false, error: "nir_key_invalid" };
  }

  return { valid: true };
}

/**
 * Masks a decrypted NIR for display.
 * Returns e.g. "1 78 12 75 *** *** **" (preserves sex/year/month/dept, masks the rest).
 */
export function maskNir(nir: string): string {
  const t = nir.trim();
  if (t.length !== 15) return "*** *** *** *** **";
  // sex YY MM CC *** *** **
  return `${t[0]} ${t.slice(1, 3)} ${t.slice(3, 5)} ${t.slice(5, 7)} *** *** **`;
}
