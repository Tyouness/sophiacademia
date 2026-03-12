import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const navItems = [
  { href: "/professor", label: "Dashboard" },
  { href: "/professor/offers", label: "Mes offres" },
  { href: "/professor/requests", label: "Planning" },
  { href: "/professor/courses", label: "Mes cours" },
  { href: "/professor/payslips", label: "Mes paiements" },
  { href: "/professor/profile", label: "Profil" },
];

export default async function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  // Garde de rôle : seuls les comptes "professor" accèdent ici
  if (!user) redirect("/login/professeur");
  if (profile?.role && profile.role !== "professor") redirect("/login/professeur?error=Acc%C3%A8s+réserv%C3%A9+aux+professeurs");

  return (
    <AppShell
      title="Professeur"
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
