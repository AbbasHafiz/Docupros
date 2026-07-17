"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ScanFlow } from "@/components/ScanFlow";

function ScanPageInner() {
  const params = useSearchParams();
  const appendToId = params.get("append") ?? undefined;
  return <ScanFlow appendToId={appendToId} />;
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Opening scanner…</div>}>
      <ScanPageInner />
    </Suspense>
  );
}
