"use client";

import { usePathname } from "next/navigation";

export function SiteCredit() {
  const pathname = usePathname();
  // Keep immersive scanner/editor screens clean
  if (
    pathname?.startsWith("/scan") ||
    pathname?.startsWith("/document") ||
    pathname?.includes("/edit") ||
    pathname?.includes("/form")
  ) {
    return null;
  }

  return (
    <footer className="site-credit" aria-label="Site credit">
      This tool developed by Hafiz Abbas
    </footer>
  );
}
