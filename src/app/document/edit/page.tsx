"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageEditor } from "@/components/PageEditor";

function EditInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const pageId = params.get("page") ?? undefined;
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
  return <PageEditor documentId={id} pageId={pageId} />;
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Opening editor…</div>}>
      <EditInner />
    </Suspense>
  );
}
