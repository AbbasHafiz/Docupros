"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import type { DocumentRecord } from "@/lib/types";
import { documentHref } from "@/lib/routes";

const HINTS: Record<string, string> = {
  sign: "Open a document, then use Edit → Sign.",
  watermark: "Open a document, then Watermark.",
  erase: "Open Edit page → Smart Erase.",
  pages: "Open a document → Pages to reorder.",
  form: "Open Form fill on a document.",
  print: "Open a document → Print / ID Print.",
};

function PickInner() {
  const params = useSearchParams();
  const action = params.get("action") ?? "edit";
  const router = useRouter();
  const hint = HINTS[action] ?? "Choose a document.";

  const go = (docs: DocumentRecord[]) => {
    const doc = docs[0];
    if (!doc) return;
    if (action === "form") router.push(documentHref(doc.id, "form"));
    else if (action === "sign" || action === "erase")
      router.push(documentHref(doc.id, "edit"));
    else router.push(documentHref(doc.id));
  };

  return (
    <main className="home">
      <AppHeader title="Choose document" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        {hint}
      </p>
      <DocPicker onSelect={go} />
      <p style={{ marginTop: "1rem" }}>
        <Link href="/tools" className="text-btn">
          ← Tools
        </Link>
      </p>
    </main>
  );
}

export default function PickDocPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Loading…</div>}>
      <PickInner />
    </Suspense>
  );
}
