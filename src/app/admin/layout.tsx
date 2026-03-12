import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth/session";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/families", label: "Gestion familles" },
  { href: "/admin/professors", label: "Gestion profs" },
  { href: "/admin/requests", label: "Demandes" },
  { href: "/admin/courses", label: "Cours" },
  { href: "/admin/invoices", label: "Factures" },
  { href: "/admin/payslips", label: "Bulletins" },
  { href: "/admin/payroll", label: "Paie mensuelle" },
  { href: "/admin/consistency", label: "Cohérence" },
  { href: "/admin/prelive", label: "Pré-live" },
  { href: "/admin/decision", label: "Décision" },
  { href: "/admin/pilot", label: "Pilote" },
  { href: "/admin/audit", label: "Audit" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  return (
    <AppShell
      title="Admin"
      subtitle="Pilotage et configuration"
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
