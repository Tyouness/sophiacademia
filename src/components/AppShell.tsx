import SidebarNav, { NavItem } from "@/components/SidebarNav";
import TopBar from "@/components/TopBar";

export type AppShellUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type AppShellProps = {
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  user: AppShellUser;
  children: React.ReactNode;
};

export default function AppShell({
  title,
  subtitle,
  navItems,
  user,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="flex">
        <SidebarNav title={title} subtitle={subtitle} items={navItems} />
        <div className="flex min-h-screen flex-1 flex-col">
          <TopBar
            title={title}
            userName={user.name}
            userEmail={user.email}
            roleLabel={user.role}
          />
          <main className="flex-1 bg-[#F8FAFF] px-8 py-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
