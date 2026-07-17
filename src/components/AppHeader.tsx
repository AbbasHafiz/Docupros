"use client";

import Link from "next/link";

type Props = {
  title?: string;
  backHref?: string;
  action?: React.ReactNode;
};

export function AppHeader({ title = "Docupros", backHref, action }: Props) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        {backHref ? (
          <Link href={backHref} className="back-link" aria-label="Back">
            ←
          </Link>
        ) : (
          <span className="brand-mark" aria-hidden>
            ▦
          </span>
        )}
        <h1 className="brand">{title}</h1>
        <div className="header-action">{action}</div>
      </div>
    </header>
  );
}
