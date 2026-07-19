"use client";

import Link from "next/link";

type Props = {
  title?: string;
  backHref?: string;
  action?: React.ReactNode;
  elevated?: boolean;
};

export function AppHeader({
  title = "Docupros",
  backHref,
  action,
  elevated = true,
}: Props) {
  return (
    <header className={`app-header ${elevated ? "is-elevated" : ""}`}>
      <div className="app-header-inner">
        {backHref ? (
          <Link href={backHref} className="back-link" aria-label="Back">
            <svg viewBox="0 0 24 24" aria-hidden className="header-icon">
              <path
                fill="currentColor"
                d="M15.4 4.6a1.1 1.1 0 0 1 0 1.55L9.55 12l5.85 5.85a1.1 1.1 0 1 1-1.55 1.55l-6.6-6.6a1.1 1.1 0 0 1 0-1.55l6.6-6.65a1.1 1.1 0 0 1 1.55 0Z"
              />
            </svg>
          </Link>
        ) : (
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24" className="header-icon">
              <path
                fill="currentColor"
                d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5H7Zm6.8.8V8H18l-4.2-3.7Z"
              />
            </svg>
          </span>
        )}
        <h1 className="brand">{title}</h1>
        <div className="header-action">{action ?? <span className="header-spacer" />}</div>
      </div>
    </header>
  );
}
