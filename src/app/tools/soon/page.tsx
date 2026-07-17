"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";

function SoonInner() {
  const params = useSearchParams();
  const name = params.get("name") ?? "This tool";
  return (
    <main className="home">
      <AppHeader title={name} backHref="/tools" />
      <div className="empty-library" style={{ marginTop: "1.5rem" }}>
        <p className="empty-kicker">Coming soon</p>
        <p className="empty-copy">
          {name} is on the roadmap (CamScanner parity). Nearby tools that work
          today: Extract Text, To Word, Merge, Lock, PDF to Images, Form Fill.
        </p>
        <Link href="/tools" className="btn-primary">
          Back to Tools
        </Link>
      </div>
    </main>
  );
}

export default function SoonPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Loading…</div>}>
      <SoonInner />
    </Suspense>
  );
}
