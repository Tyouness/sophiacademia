import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const navItems = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/families", label: "Gestion familles" },
  { href: "/staff/professors", label: "Gestion profs" },
  { href: "/staff/requests", label: "Demandes" },
  { href: "/staff/courses", label: "Cours" },
  { href: "/staff/invoices", label: "Factures" },
  { href: "/staff/payslips", label: "Bulletins" },
];

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) redirect("/login");
  if (profile?.role !== "staff" && profile?.role !== "admin") {
    redirect("/login?error=Acc%C3%A8s+r%C3%A9serv%C3%A9");
  }

  return (
    <AppShell
      title="Staff"
      subtitle="Operations quotidiennes"
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
