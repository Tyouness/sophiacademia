/**
 * IBAN (International Bank Account Number) utilities.
 *
 * Standard IBAN structure: 2-letter country code + 2 check digits + BBAN (up to 30 chars).
 * French IBAN: FR + 2 digits + 23 alphanumeric = 27 characters total.
 *
 * Validation uses the standard mod-97 algorithm (ISO 13616):
 *   1. Move the first 4 chars to the end.
 *   2. Replace each letter with its decimal value (A=10, B=11, …, Z=35).
 *   3. Result mod 97 must equal 1.
 */

/** Removes all spaces and converts to uppercase for normalisation. */
export function normaliseIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/** Validates an IBAN using the ISO 13616 mod-97 algorithm. */
export function validateIban(iban: string): { valid: boolean; error?: string } {
  const normalised = normaliseIban(iban);

  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(normalised)) {
    return { valid: false, error: "iban_format_invalid" };
  }

  // Rearrange: move first 4 chars to the end, then replace letters with digits
  const rearranged = normalised.slice(4) + normalised.slice(0, 4);
  const numeric = rearranged.split("").map((c) => {
    const code = c.charCodeAt(0);
    // A=65 → 10, Z=90 → 35
    return code >= 65 && code <= 90 ? String(code - 55) : c;
  }).join("");

  // Compute mod 97 on large integer via BigInt — use BigInt() constructor (not literals) for ES2017 compat
  const remainder = BigInt(numeric) % BigInt(97);
  if (remainder !== BigInt(1)) {
    return { valid: false, error: "iban_checksum_invalid" };
  }

  return { valid: true };
}

/**
 * Masks an IBAN for display.
 * Shows the first 4 characters (country + check digits) and the last 4, replacing
 * everything in between with asterisks grouped by 4.
 *
 * Example: "FR76 1234 5678 9012 3456 7890 123"
 *       →  "FR76 **** **** **** **** **** 123"
 */
export function maskIban(iban: string): string {
  const normalised = normaliseIban(iban);
  if (normalised.length < 8) return "****";

  const head = normalised.slice(0, 4);
  const tail = normalised.slice(-3);
  const middleLength = normalised.length - 7; // 4 head + 3 tail
  const masked = "*".repeat(middleLength > 0 ? middleLength : 0);

  // Group everything by 4 for readability
  const fullMasked = head + masked + tail;
  return fullMasked.replace(/(.{4})/g, "$1 ").trim();
}
