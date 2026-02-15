import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth/session";

const navItems = [
  { href: "/professor", label: "Dashboard" },
  { href: "/professor/offers", label: "Offres" },
  { href: "/professor/courses", label: "Cours" },
  { href: "/professor/payslips", label: "Bulletins" },
  { href: "/professor/profile", label: "Profil" },
];

export default async function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

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
