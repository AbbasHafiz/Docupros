"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ScanFlow } from "@/components/ScanFlow";
import type { ScanMode } from "@/lib/types";

const MODES: ScanMode[] = [
  "document",
  "id_card",
  "book",
  "slides",
  "whiteboard",
  "timestamp",
];

function ScanPageInner() {
  const params = useSearchParams();
  const appendToId = params.get("append") ?? undefined;
  const retakePageId = params.get("retake") ?? undefined;
  const modeParam = params.get("mode") as ScanMode | null;
  const mode: ScanMode =
    modeParam && MODES.includes(modeParam) ? modeParam : "document";
  return (
    <ScanFlow
      appendToId={appendToId}
      mode={mode}
      retakePageId={retakePageId}
    />
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Opening scanner…</div>}>
      <ScanPageInner />
    </Suspense>
  );
}
