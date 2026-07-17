"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ScanFlow } from "@/components/ScanFlow";
import type { ScanMode } from "@/lib/types";

function ScanPageInner() {
  const params = useSearchParams();
  const appendToId = params.get("append") ?? undefined;
  const modeParam = params.get("mode");
  const mode: ScanMode = modeParam === "id_card" ? "id_card" : "document";
  return <ScanFlow appendToId={appendToId} mode={mode} />;
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Opening scanner…</div>}>
      <ScanPageInner />
    </Suspense>
  );
}
