import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams?: { notice?: string };
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {searchParams?.notice === "access_denied" && (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Acces refuse. Droits insuffisants.
        </p>
      )}
      <div className="rounded border border-zinc-200 bg-white p-4 text-sm">
        <p>Email: {user.email}</p>
        <p>Role: {profile?.role ?? "inconnu"}</p>
      </div>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Se deconnecter
        </button>
      </form>
    </main>
  );
}
