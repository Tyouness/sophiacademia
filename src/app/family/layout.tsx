import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth/session";

const navItems = [
  { href: "/family", label: "Dashboard" },
  { href: "/family/courses", label: "Cours" },
  { href: "/family/invoices", label: "Factures" },
  { href: "/family/profile", label: "Profil" },
];

export default async function FamilyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

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
