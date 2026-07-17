"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageEditor } from "@/components/PageEditor";

function EditInner({ id }: { id: string }) {
  const params = useSearchParams();
  const pageId = params.get("page") ?? undefined;
  return <PageEditor documentId={id} pageId={pageId} />;
}

export default function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="center-pad muted">Opening editor…</div>}>
      <EditInner id={id} />
    </Suspense>
  );
}
