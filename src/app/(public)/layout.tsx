import Link from "next/link";
import type { Metadata } from "next";
import BackgroundEducationalPattern from "@/components/public/BackgroundEducationalPattern";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.sophiacademia.fr"),
};

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/fonctionnement", label: "Fonctionnement" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
];

const legalLinks = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/politique-rgpd", label: "Politique RGPD" },
  { href: "/conditions-sap-mandataire", label: "Conditions SAP" },
];

const cities = [
  "Sophia Antipolis", "Valbonne", "Antibes", "Biot",
  "Grasse", "Villeneuve-Loubet", "Cagnes-sur-Mer",
  "Nice", "Juan-les-Pins", "Cannes", "Le Cannet",
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-screen" style={{ color: "#0F172A" }}>
      {/* Background éducatif — fixed derrière tout le contenu */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <BackgroundEducationalPattern />
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10"
        style={{ backgroundColor: "rgba(15,23,42,0.96)", backdropFilter: "blur(12px)" }}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="Sophiacademia — accueil">
            <span
              className="font-display text-xl font-bold tracking-tight"
              style={{ color: "#FFFFFF", fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              Sophia<span style={{ color: "#F59E0B" }}>academia</span>
            </span>
            <span
              className="hidden sm:inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ backgroundColor: "#1E3A5F", color: "#F59E0B" }}
            >
              06
            </span>
          </Link>

          {/* Liens nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="Navigation principale">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-slate-400 hover:text-amber-400 transition-colors duration-150"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA nav */}
          <div className="flex items-center gap-3">
            <Link
              href="/#rappel"
              className="hidden sm:inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
            >
              Être rappelé
            </Link>

            {/* Dropdown Espace client — CSS-only, aucun JS client */}
            <div className="relative group">
              <button
                type="button"
                className="rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: "#334155", color: "#94A3B8" }}
                aria-haspopup="true"
              >
                Espace client
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="transition-transform group-hover:rotate-180">
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Dropdown menu */}
              <div
                className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150 z-50"
                style={{ backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>Connexion</p>
                </div>
                <Link
                  href="/login/famille"
                  className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: "#E2E8F0" }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-base flex-shrink-0" style={{ backgroundColor: "rgba(245,158,11,0.12)" }}>&#128106;</span>
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: "#FFFFFF" }}>Je suis une Famille</span>
                    <span className="block text-xs" style={{ color: "#64748B" }}>Suivi cours &amp; factures</span>
                  </span>
                </Link>
                <Link
                  href="/login/professeur"
                  className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: "#E2E8F0", borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-base flex-shrink-0" style={{ backgroundColor: "rgba(147,197,253,0.1)" }}>&#127891;</span>
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: "#FFFFFF" }}>Je suis un Professeur</span>
                    <span className="block text-xs" style={{ color: "#64748B" }}>Cours &amp; paiements</span>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Contenu pages (full-bleed — chaque section gère son fond) ── */}
      <main>{children}</main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: "#0F172A", color: "#94A3B8" }}>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">

            {/* Colonne marque */}
            <div>
              <p
                className="font-display text-2xl font-bold mb-3"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}
              >
                Sophia<span style={{ color: "#F59E0B" }}>academia</span>
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>
                Cours particuliers à domicile dans les Alpes-Maritimes.<br />
                Professeurs issus des grandes écoles de Sophia Antipolis.<br />
                Sélection sous 48h · Crédit d&apos;impôt 50 %
              </p>
              <p className="mt-4 text-xs" style={{ color: "#475569" }}>
                Service à la personne agrée — SAP mandataire
              </p>
            </div>

            {/* Colonne villes */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>
                Nos secteurs
              </p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {cities.map((city) => (
                  <li key={city}>
                    <Link
                      href={`/villes/${city.toLowerCase().replace(/ /g, "-")}`}
                      className="transition-colors hover:text-white"
                      style={{ color: "#64748B" }}
                    >
                      {city}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Colonne légal */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>
                Informations
              </p>
              <ul className="flex flex-col gap-2 text-sm">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-white"
                      style={{ color: "#64748B" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs" style={{ color: "#334155" }}>
                © {new Date().getFullYear()} Sophiacademia. Tous droits réservés.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
