"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getDocument, saveDocument } from "@/lib/storage";
import { downloadBlob } from "@/lib/pdf";
import { fillImportedPdfForm } from "@/lib/formPdf";
import { documentHref } from "@/lib/routes";
import type { DocumentRecord } from "@/lib/types";

function PdfFormInner() {
  const search = useSearchParams();
  const id = search.get("id") ?? "";
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getDocument(id).then((d) => {
      if (cancelled) return;
      setDoc(d ?? null);
      if (d?.formFields) {
        const v: Record<string, string> = {};
        for (const f of d.formFields) v[f.name] = f.value;
        setValues(v);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  if (!doc) {
    return (
      <div className="center-pad">
        <p className="muted">Form not found.</p>
        <Link href="/" className="btn-primary">
          Back
        </Link>
      </div>
    );
  }

  const saveValues = async () => {
    const formFields = (doc.formFields ?? []).map((f) => ({
      ...f,
      value: values[f.name] ?? f.value,
      checked: (values[f.name] ?? f.value) === "true",
    }));
    const updated = { ...doc, formFields, updatedAt: Date.now() };
    await saveDocument(updated);
    setDoc(updated);
    setStatus("Saved");
  };

  const exportFilled = async () => {
    if (!doc.sourcePdfBase64) {
      startTransition(() => router.push(documentHref(doc.id, "form")));
      return;
    }
    setBusy(true);
    try {
      await saveValues();
      const blob = await fillImportedPdfForm(doc.sourcePdfBase64, values);
      downloadBlob(
        blob,
        `${doc.title.replace(/\s+/g, "-").toLowerCase()}-filled.pdf`,
      );
      setStatus("Filled PDF downloaded");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader title={doc.title} backHref={documentHref(doc.id)} />
      <main className="home" style={{ paddingBottom: "2rem" }}>
        <p className="hero-copy">Fill PDF form fields, then export.</p>
        {status && <p className="busy-bar">{status}</p>}

        <div className="text-edit-box" style={{ marginTop: "1rem" }}>
          {(doc.formFields ?? []).map((f) => (
            <label key={f.id} className="field">
              <span>{f.label || f.name}</span>
              {f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={
                    values[f.name] === "true" || values[f.name] === "yes"
                  }
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [f.name]: e.target.checked ? "true" : "false",
                    }))
                  }
                />
              ) : (
                <input
                  value={values[f.name] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
          {(doc.formFields ?? []).length === 0 && (
            <p className="hint">No fields. Use Form Fill to add visual fields.</p>
          )}
        </div>

        <div className="row-actions" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void exportFilled()}
          >
            Export filled PDF
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void saveValues()}
          >
            Save values
          </button>
          <Link href={documentHref(doc.id, "form")} className="btn-secondary">
            Visual form editor
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function PdfFormFillPage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Opening…</div>}>
      <PdfFormInner />
    </Suspense>
  );
}
