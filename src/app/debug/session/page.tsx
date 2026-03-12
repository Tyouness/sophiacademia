import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DebugSessionPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">Debug session</h1>
        <p className="text-sm text-zinc-600">Aucune session.</p>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Debug session</h1>
      <div className="rounded border border-zinc-200 bg-white p-4 text-sm">
        <p>User ID: {user.id}</p>
        <p>Email: {user.email}</p>
        <p>Role: {profile?.role ?? "inconnu"}</p>
      </div>
    </main>
  );
}
