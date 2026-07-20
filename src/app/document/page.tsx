"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DocumentViewer } from "@/components/DocumentViewer";

function DocumentInner() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) {
    return (
      <div className="center-pad">
        <p className="muted">Missing document id.</p>
        <Link href="/files" className="btn-primary">
          Files
        </Link>
      </div>
    );
  }
  return <DocumentViewer key={id} id={id} />;
}

export default function DocumentPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Opening…</div>}>
      <DocumentInner />
    </Suspense>
  );
}
