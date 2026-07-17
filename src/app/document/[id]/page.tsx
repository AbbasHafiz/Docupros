"use client";

import { use } from "react";
import { DocumentViewer } from "@/components/DocumentViewer";

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DocumentViewer id={id} />;
}
