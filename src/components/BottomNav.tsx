"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="nav-icon">
        <path
          fill="currentColor"
          d="M10.5 3.2 3.7 9.2c-.4.35-.6.8-.6 1.3V20a1.5 1.5 0 0 0 1.5 1.5H9a1 1 0 0 0 1-1v-5.2a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8V20.5a1 1 0 0 0 1 1h4.4A1.5 1.5 0 0 0 21 20v-9.5c0-.5-.2-.95-.6-1.3l-6.8-6a2.2 2.2 0 0 0-3.1 0Z"
        />
      </svg>
    ),
  },
  {
    href: "/files",
    label: "Files",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="nav-icon">
        <path
          fill="currentColor"
          d="M3.5 6.5A2.5 2.5 0 0 1 6 4h3.2c.5 0 1 .2 1.3.6l1 1.2c.3.4.8.6 1.3.6H18A2.5 2.5 0 0 1 20.5 9v9A2.5 2.5 0 0 1 18 20.5H6A2.5 2.5 0 0 1 3.5 18Z"
        />
      </svg>
    ),
  },
  {
    href: "/tools",
    label: "Tools",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="nav-icon">
        <path
          fill="currentColor"
          d="M10.2 3.5h3.6a1.2 1.2 0 0 1 1.2 1.05l.2 1.5a6.8 6.8 0 0 1 1.35.78l1.35-.75a1.2 1.2 0 0 1 1.55.35l1.8 3.12a1.2 1.2 0 0 1-.35 1.55l-1.35.78c.08.45.13.9.13 1.37s-.05.92-.13 1.37l1.35.78a1.2 1.2 0 0 1 .35 1.55l-1.8 3.12a1.2 1.2 0 0 1-1.55.35l-1.35-.75a6.8 6.8 0 0 1-1.35.78l-.2 1.5a1.2 1.2 0 0 1-1.2 1.05h-3.6a1.2 1.2 0 0 1-1.2-1.05l-.2-1.5a6.8 6.8 0 0 1-1.35-.78l-1.35.75a1.2 1.2 0 0 1-1.55-.35l-1.8-3.12a1.2 1.2 0 0 1 .35-1.55l1.35-.78A7.4 7.4 0 0 1 3.5 12c0-.47.05-.92.13-1.37l-1.35-.78a1.2 1.2 0 0 1-.35-1.55l1.8-3.12a1.2 1.2 0 0 1 1.55-.35l1.35.75a6.8 6.8 0 0 1 1.35-.78l.2-1.5a1.2 1.2 0 0 1 1.2-1.05ZM12 8.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Z"
        />
      </svg>
    ),
  },
  {
    href: "/me",
    label: "Me",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="nav-icon">
        <path
          fill="currentColor"
          d="M12 3.5a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Zm0 10c4.1 0 7.5 2.3 7.5 5.2v.6c0 .9-.7 1.7-1.6 1.7H6.1c-.9 0-1.6-.8-1.6-1.7v-.6c0-2.9 3.4-5.2 7.5-5.2Z"
        />
      </svg>
    ),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  if (
    pathname?.startsWith("/scan") ||
    pathname?.startsWith("/document") ||
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
            <span className="nav-icon-wrap">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
