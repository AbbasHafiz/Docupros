"use client";

import { use } from "react";
import { FormFillEditor } from "@/components/FormFillEditor";

export default function FormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <FormFillEditor documentId={id} />;
}
