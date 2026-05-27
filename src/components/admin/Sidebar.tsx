"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Orders", href: "/orders" },
  { label: "Payments", href: "/payments" },
  { label: "Inventory", href: "/inventory" },
  { label: "Production", href: "/production" },
  { label: "Deliveries", href: "/deliveries" },
  { label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-slate-900 text-slate-100">
      <div className="border-b border-slate-800 px-6 py-5">
        <p className="text-lg font-semibold tracking-tight">FreshStack</p>
        <p className="mt-1 text-sm text-slate-400">Fulfillment Admin</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
