-- Migration 0024: Add encrypted social/banking fields and gross hourly override to professor_profiles.
--
-- Changes:
--   • nir_encrypted (text, nullable) — NIR encrypted via AES-256-GCM (replaces plain nir column)
--   • iban_encrypted (text, nullable) — IBAN encrypted via AES-256-GCM
--   • bic (text, nullable) — BIC/SWIFT code (public bank identifier, not encrypted)
--   • gross_hourly_override (numeric(10,4), nullable) — per-professor base gross rate;
--     when NULL the payroll engine falls back to FR_2026_01.defaultGrossHourly (15.0 €/h)
--
-- ── NIR MIGRATION — ABSENCE DE BACKFILL : justification et traçabilité ──────────────────
--
-- L'ancienne colonne `nir` (plain text) est supprimée sans backfill vers `nir_encrypted`.
-- Raison : le chiffrement AES-256-GCM est réalisé dans la couche applicative
-- (lib/security/crypto.ts via FISCAL_ENCRYPTION_KEY). Il n'est pas exécutable dans
-- une migration SQL sans exposer la clé dans l'historique de migration.
--
-- Hypothèse de sécurité : la colonne `nir` n'a jamais été alimentée par aucune route
-- métier en production. Vérification effectuée par audit du code source (grep: aucune
-- route ne fait INSERT/UPDATE de nir sur professor_profiles). Il n'existait aucune UI,
-- aucun endpoint staff/admin, aucune fixture de test qui écrivait dans nir.
--
-- Si un doute subsiste sur la présence de données réelles :
--   1. Vérifier les backups Supabase antérieurs au 10 mars 2026 (avant application de 0024).
--   2. Requête de contrôle à exécuter sur un backup restauré :
--      SELECT id, nir FROM professor_profiles WHERE nir IS NOT NULL;
--   3. Si des valeurs sont trouvées, les chiffrer manuellement via l'API :
--      PATCH /api/staff/users/update-social { userId, nir: "<valeur_déchiffrée>" }
--
-- Cette migration suppose donc une base vierge sur ce champ — risque zéro si l'hypothèse
-- est vraie, risque de perte silencieuse si elle est fausse (irréversible post-migration).

ALTER TABLE professor_profiles
  ADD COLUMN IF NOT EXISTS nir_encrypted      text,
  ADD COLUMN IF NOT EXISTS iban_encrypted     text,
  ADD COLUMN IF NOT EXISTS bic                text,
  ADD COLUMN IF NOT EXISTS gross_hourly_override numeric(10,4);

-- Drop the legacy plain-text nir column (was never written by any route in production).
ALTER TABLE professor_profiles
  DROP COLUMN IF EXISTS nir;

COMMENT ON COLUMN professor_profiles.nir_encrypted      IS 'AES-256-GCM encrypted French social security number (NIR). Encrypt/decrypt via lib/security/crypto.ts. Never expose raw to front-end.';
COMMENT ON COLUMN professor_profiles.iban_encrypted     IS 'AES-256-GCM encrypted IBAN. Encrypt/decrypt via lib/security/crypto.ts. Expose only masked (first4...last4) to front-end.';
COMMENT ON COLUMN professor_profiles.bic                IS 'BIC/SWIFT code. Not sensitive — public bank identifier.';
COMMENT ON COLUMN professor_profiles.gross_hourly_override IS 'Per-professor base gross hourly rate in EUR. When NULL the payroll engine uses FR_2026_01.defaultGrossHourly (15.0 €/h).';
