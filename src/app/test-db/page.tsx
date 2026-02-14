import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TestDbPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">Test DB</h1>
        <p className="text-sm text-zinc-600">
          Variables Supabase manquantes. Configurez .env.local pour tester.
        </p>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("healthcheck")
    .select("id")
    .limit(1);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Test DB</h1>
      <p className="text-sm text-zinc-600">
        Requete serveur vers Supabase (table healthcheck).
      </p>
      <div className="rounded border border-zinc-200 bg-white p-4 text-sm">
        {error ? (
          <pre className="whitespace-pre-wrap text-red-600">
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : (
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
