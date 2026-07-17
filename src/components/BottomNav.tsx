"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/files", label: "Files", icon: "📁" },
  { href: "/tools", label: "Tools", icon: "▦" },
  { href: "/me", label: "Me", icon: "👤" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  // Hide on immersive flows
  if (
    pathname?.startsWith("/scan") ||
    pathname?.includes("/edit") ||
    pathname?.includes("/form")
  ) {
    return null;
  }

  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => {
        const active =
          tab.href === "/"
            ? pathname === "/"
            : pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`bottom-nav-item ${active ? "is-active" : ""}`}
          >
            <span aria-hidden>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
