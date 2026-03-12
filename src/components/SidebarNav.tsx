"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
};

type SidebarNavProps = {
  title: string;
  subtitle?: string;
  items: NavItem[];
};

export default function SidebarNav({ title, subtitle, items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-blue-100 bg-white">
      <div className="px-6 py-8">
        <p className="text-xs uppercase tracking-[0.32em] text-blue-600/80">
          Sophiacademia
        </p>
        <h2 className="mt-3 text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        ) : null}
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 pb-6">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                  : "rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-600"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
