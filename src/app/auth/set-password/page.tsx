type SetPasswordPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function SetPasswordPage({
  searchParams,
}: SetPasswordPageProps) {
  const resolvedParams = await searchParams;
  const error = resolvedParams?.error;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Definir votre mot de passe
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Choisissez un mot de passe pour finaliser la connexion.
      </p>

      <form
        method="post"
        action="/auth/set-password/action"
        className="mt-6 space-y-4"
      >
        <label className="block text-sm font-medium" htmlFor="password">
          Nouveau mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
        />
        <label className="block text-sm font-medium" htmlFor="confirmPassword">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Enregistrer
        </button>
      </form>

      {error && (
        <p className="mt-4 text-sm text-red-600">Erreur: {error}</p>
      )}
    </main>
  );
}
