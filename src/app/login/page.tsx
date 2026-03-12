type LoginPageProps = {
  searchParams?: Promise<{ sent?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = await searchParams;
  const sent = resolvedParams?.sent === "1";
  const error = resolvedParams?.error;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Accedez a votre espace avec votre email et mot de passe.
      </p>

      <form method="post" action="/auth/login" className="mt-6 space-y-4">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
        />
        <label className="block text-sm font-medium" htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Se connecter
        </button>
      </form>

      <form method="post" action="/auth/forgot" className="mt-6 space-y-3">
        <label className="block text-sm font-medium" htmlFor="reset-email">
          Mot de passe oublie
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-full rounded border border-zinc-200 px-4 py-2 text-sm font-medium"
        >
          Envoyer le lien de reinitialisation
        </button>
      </form>

      {sent && (
        <p className="mt-4 text-sm text-emerald-600">
          Lien envoye. Verifiez votre boite email.
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600">Erreur: {error}</p>
      )}
    </main>
  );
}
