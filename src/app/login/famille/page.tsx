import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connexion Famille | Sophiacademia",
  description: "Accédez à votre espace famille Sophiacademia.",
};

type Props = { searchParams?: Promise<{ error?: string; sent?: string }> };

export default async function LoginFamillePage({ searchParams }: Props) {
  const params = await searchParams;
  const error = params?.error;
  const sent = params?.sent === "1";

  return (
    <main>
      {/* HERO */}
      <section
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)" }}
        className="min-h-screen flex items-center justify-center px-6 py-16"
      >
        <div className="w-full max-w-md">

          {/* Badge */}
          <div className="mb-8 flex items-center gap-3">
            <Link
              href="/"
              className="font-bold text-xl tracking-tight"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}
            >
              Sophia<span style={{ color: "#F59E0B" }}>academia</span>
            </Link>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
            >
              Espace Famille
            </span>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>
              Connexion
            </p>
            <h1
              className="text-2xl font-bold mb-1"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#FFFFFF" }}
            >
              Espace Famille
            </h1>
            <div className="mt-2 mb-6 h-[2px] w-8 rounded-full" style={{ backgroundColor: "#F59E0B" }} aria-hidden />
            <p className="mb-8 text-sm leading-6" style={{ color: "#94A3B8" }}>
              Accédez à l'historique de vos cours, vos factures et le suivi de votre enfant.
            </p>

            <form method="POST" action="/auth/login" className="space-y-4">
              {/* role_hint — champ caché pour vérification côté serveur */}
              <input type="hidden" name="role_hint" value="famille" />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#94A3B8" }}>
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="votre@email.fr"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#FFFFFF",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#94A3B8" }}>
                  Mot de passe
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#FFFFFF",
                  }}
                />
              </div>

              {error && (
                <p className="rounded-xl px-4 py-3 text-sm font-medium" style={{ backgroundColor: "rgba(220,38,38,0.12)", color: "#FCA5A5", border: "1px solid rgba(220,38,38,0.2)" }}>
                  {error}
                </p>
              )}
              {sent && (
                <p className="rounded-xl px-4 py-3 text-sm font-medium" style={{ backgroundColor: "rgba(5,150,105,0.12)", color: "#6EE7B7", border: "1px solid rgba(5,150,105,0.2)" }}>
                  Lien envoyé. Vérifiez votre boîte email.
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-full py-3 text-sm font-bold transition-opacity hover:opacity-90 mt-2"
                style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
              >
                Se connecter
              </button>
            </form>

            {/* Lien mot de passe oublié */}
            <details className="mt-6">
              <summary className="cursor-pointer text-xs text-center" style={{ color: "#64748B" }}>
                Mot de passe oublié ?
              </summary>
              <form method="POST" action="/auth/forgot" className="mt-4 space-y-3">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="votre@email.fr"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#FFFFFF",
                  }}
                />
                <button
                  type="submit"
                  className="w-full rounded-full border py-2.5 text-xs font-semibold transition-colors hover:bg-white/10"
                  style={{ borderColor: "rgba(255,255,255,0.2)", color: "#CBD5E1" }}
                >
                  Envoyer le lien de réinitialisation
                </button>
              </form>
            </details>
          </div>

          {/* Switch vers login prof */}
          <p className="mt-6 text-center text-xs" style={{ color: "#475569" }}>
            Vous êtes professeur ?{" "}
            <Link href="/login/professeur" className="font-semibold hover:text-amber-400 transition-colors" style={{ color: "#F59E0B" }}>
              Espace Professeur →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
