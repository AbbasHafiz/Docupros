"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormFillEditor } from "@/components/FormFillEditor";

function FormInner() {
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
  return <FormFillEditor documentId={id} />;
}

export default function FormPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Opening form…</div>}>
      <FormInner />
    </Suspense>
  );
}
