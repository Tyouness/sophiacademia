import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const navItems = [
  { href: "/family", label: "Dashboard" },
  { href: "/family/children", label: "Mes enfants" },
  { href: "/family/courses", label: "Historique cours" },
  { href: "/family/invoices", label: "Mes factures" },
  { href: "/family/profile", label: "Profil" },
];

export default async function FamilyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  // Garde de rôle : seuls les comptes "family" accèdent ici
  if (!user) redirect("/login/famille");
  if (profile?.role && profile.role !== "family") redirect("/login/famille?error=Acc%C3%A8s+réserv%C3%A9+aux+familles");

  return (
    <AppShell
      title="Famille"
      subtitle="Suivi des cours"
      navItems={navItems}
      user={{
        name: profile?.full_name ?? user?.email ?? null,
        email: user?.email ?? profile?.email ?? null,
        role: profile?.role ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
