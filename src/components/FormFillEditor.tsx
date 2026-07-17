"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignaturePad } from "./SignaturePad";
import type { DocumentRecord, FormField, FormFieldType } from "@/lib/types";
import { createId } from "@/lib/id";
import { getDocument, saveDocument } from "@/lib/storage";
import { loadImage } from "@/lib/imageProcessing";
import { downloadBlob } from "@/lib/pdf";
import { exportFillablePdf } from "@/lib/formPdf";
import { documentHref } from "@/lib/routes";

type Props = {
  documentId: string;
};

type Mode = "fill" | "edit";

const FIELD_TYPES: { id: FormFieldType; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "multiline", label: "Notes" },
  { id: "checkbox", label: "Check" },
  { id: "date", label: "Date" },
  { id: "signature", label: "Sign" },
];

function stamp(doc: DocumentRecord, patch: Partial<DocumentRecord>): DocumentRecord {
  return { ...doc, ...patch, updatedAt: Date.now() };
}

export function FormFillEditor({ documentId }: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("fill");
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addType, setAddType] = useState<FormFieldType>("text");
  const [placing, setPlacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [signOpen, setSignOpen] = useState(false);
  const [signFieldId, setSignFieldId] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string;
    ox: number;
    oy: number;
    mode: "move" | "resize";
  } | null>(null);

  const page = doc?.pages[pageIndex];
  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const pageFields = fields.filter((f) => f.pageId === page?.id);

  useEffect(() => {
    let cancelled = false;
    void getDocument(documentId).then((d) => {
      if (cancelled) return;
      if (!d) {
        setDoc(null);
        setLoading(false);
        return;
      }
      setDoc(d);
      setFields(d.formFields ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    void loadImage(page.imageDataUrl).then((img) => {
      if (cancelled) return;
      const maxW = Math.min(window.innerWidth - 24, 860);
      const maxH = Math.min(window.innerHeight * 0.5, 560);
      const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      setSize({
        w: Math.round(img.naturalWidth * s),
        h: Math.round(img.naturalHeight * s),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const persistFields = async (next: FormField[]) => {
    if (!doc) return;
    setFields(next);
    const updated = stamp(doc, { formFields: next });
    await saveDocument(updated);
    setDoc(updated);
  };

  const onPageClick = (e: React.MouseEvent) => {
    if (!placing || !page || mode !== "edit") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const defaults =
      addType === "checkbox"
        ? { w: 0.05, h: 0.035 }
        : addType === "multiline"
          ? { w: 0.42, h: 0.1 }
          : addType === "signature"
            ? { w: 0.28, h: 0.08 }
            : { w: 0.28, h: 0.045 };

    const field: FormField = {
      id: createId(),
      pageId: page.id,
      type: addType,
      name: `${addType}_${fields.length + 1}`,
      label: FIELD_TYPES.find((t) => t.id === addType)?.label ?? "Field",
      value: addType === "date" ? new Date().toISOString().slice(0, 10) : "",
      x: Math.min(0.92, Math.max(0, x)),
      y: Math.min(0.92, Math.max(0, y)),
      w: defaults.w,
      h: defaults.h,
      checked: false,
    };
    void persistFields([...fields, field]);
    setSelectedId(field.id);
    setPlacing(false);
    setStatus("Field added — fill or drag to reposition");
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    const next = fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
    void persistFields(next);
  };

  const deleteField = (id: string) => {
    void persistFields(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const onFieldPointerDown = (
    e: React.PointerEvent,
    field: FormField,
    action: "move" | "resize",
  ) => {
    if (mode !== "edit") return;
    e.stopPropagation();
    setSelectedId(field.id);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragRef.current = {
      id: field.id,
      ox: e.clientX,
      oy: e.clientY,
      mode: action,
    };
  };

  const onFieldPointerMove = (e: React.PointerEvent, field: FormField) => {
    if (!dragRef.current || dragRef.current.id !== field.id || !size.w) return;
    const dx = (e.clientX - dragRef.current.ox) / size.w;
    const dy = (e.clientY - dragRef.current.oy) / size.h;
    dragRef.current.ox = e.clientX;
    dragRef.current.oy = e.clientY;

    if (dragRef.current.mode === "move") {
      updateField(field.id, {
        x: Math.min(1 - field.w, Math.max(0, field.x + dx)),
        y: Math.min(1 - field.h, Math.max(0, field.y + dy)),
      });
    } else {
      updateField(field.id, {
        w: Math.min(0.95, Math.max(0.04, field.w + dx)),
        h: Math.min(0.5, Math.max(0.025, field.h + dy)),
      });
    }
  };

  const exportPdf = async (flatten: boolean) => {
    if (!doc) return;
    setBusy(true);
    try {
      const current = { ...doc, formFields: fields };
      const blob = await exportFillablePdf(current, { flatten });
      downloadBlob(
        blob,
        `${doc.title.replace(/\s+/g, "-").toLowerCase()}-${flatten ? "filled" : "form"}.pdf`,
      );
      setStatus(flatten ? "Filled PDF exported" : "Fillable PDF exported");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="center-pad muted">Opening form…</div>;
  }

  if (!doc) {
    return (
      <div className="center-pad">
        <p className="muted">Document not found.</p>
        <Link href="/" className="btn-primary">
          Back
        </Link>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="center-pad">
        <p className="muted">No pages to fill.</p>
        <Link href={documentHref(doc.id)} className="btn-primary">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="form-editor">
      <header className="cs-topbar">
        <button
          type="button"
          className="cs-icon-btn"
          aria-label="Close"
          onClick={() => router.push(documentHref(doc.id))}
        >
          ✕
        </button>
        <div className="form-mode-toggle">
          <button
            type="button"
            className={`mini-chip ${mode === "fill" ? "is-active" : ""}`}
            onClick={() => {
              setMode("fill");
              setPlacing(false);
            }}
          >
            Fill
          </button>
          <button
            type="button"
            className={`mini-chip ${mode === "edit" ? "is-active" : ""}`}
            onClick={() => setMode("edit")}
          >
            Edit form
          </button>
        </div>
        <button
          type="button"
          className="btn-done"
          onClick={() => router.push(documentHref(doc.id))}
        >
          Done
        </button>
      </header>

      {(busy || status) && (
        <div className="busy-bar">{busy ? "Working…" : status}</div>
      )}

      <div className="form-stage" ref={wrapRef}>
        <div
          className={`form-page ${placing ? "is-placing" : ""}`}
          style={{ width: size.w, height: size.h }}
          onClick={onPageClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.imageDataUrl} alt={`Page ${pageIndex + 1}`} />
          {pageFields.map((field) => (
            <div
              key={field.id}
              className={`form-field ${selectedId === field.id ? "is-selected" : ""} type-${field.type}`}
              style={{
                left: `${field.x * 100}%`,
                top: `${field.y * 100}%`,
                width: `${field.w * 100}%`,
                height: `${field.h * 100}%`,
              }}
              onPointerDown={(e) => onFieldPointerDown(e, field, "move")}
              onPointerMove={(e) => onFieldPointerMove(e, field)}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(field.id);
              }}
            >
              {field.type === "checkbox" ? (
                <label className="form-check">
                  <input
                    type="checkbox"
                    checked={!!field.checked}
                    onChange={(e) =>
                      updateField(field.id, {
                        checked: e.target.checked,
                        value: e.target.checked ? "true" : "false",
                      })
                    }
                  />
                </label>
              ) : field.type === "signature" ? (
                <button
                  type="button"
                  className="form-sign-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSignFieldId(field.id);
                    setSignOpen(true);
                  }}
                >
                  {field.value.startsWith("data:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={field.value} alt="Signature" />
                  ) : (
                    "Tap to sign"
                  )}
                </button>
              ) : field.type === "multiline" ? (
                <textarea
                  value={field.value}
                  placeholder={field.label}
                  onChange={(e) => updateField(field.id, { value: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <input
                  type={field.type === "date" ? "date" : "text"}
                  value={field.value}
                  placeholder={field.label}
                  onChange={(e) => updateField(field.id, { value: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {mode === "edit" && selectedId === field.id && (
                <button
                  type="button"
                  className="form-resize"
                  aria-label="Resize"
                  onPointerDown={(e) => onFieldPointerDown(e, field, "resize")}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="cs-pager">
        <button
          type="button"
          className="cs-icon-btn"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((i) => i - 1)}
        >
          ‹
        </button>
        <span>
          {pageIndex + 1}/{doc.pages.length}
        </span>
        <button
          type="button"
          className="cs-icon-btn"
          disabled={pageIndex >= doc.pages.length - 1}
          onClick={() => setPageIndex((i) => i + 1)}
        >
          ›
        </button>
      </div>

      <div className="form-panel">
        {mode === "edit" && (
          <>
            <p className="panel-title">Add field</p>
            <div className="row-actions">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`mini-chip ${addType === t.id ? "is-active" : ""}`}
                  onClick={() => setAddType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`btn-secondary ${placing ? "is-active-btn" : ""}`}
              onClick={() => setPlacing((v) => !v)}
            >
              {placing ? "Tap page to place…" : "Place field on page"}
            </button>
          </>
        )}

        {selected && (
          <div className="text-edit-box">
            <p className="subhead">{selected.label}</p>
            <label className="field">
              <span>Label</span>
              <input
                value={selected.label}
                onChange={(e) =>
                  updateField(selected.id, {
                    label: e.target.value,
                    name: e.target.value.replace(/\s+/g, "_").toLowerCase(),
                  })
                }
              />
            </label>
            {selected.type !== "checkbox" && selected.type !== "signature" && (
              <label className="field">
                <span>Value</span>
                <input
                  value={selected.value}
                  onChange={(e) =>
                    updateField(selected.id, { value: e.target.value })
                  }
                />
              </label>
            )}
            {mode === "edit" && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => deleteField(selected.id)}
              >
                Delete field
              </button>
            )}
          </div>
        )}

        {mode === "fill" && pageFields.length === 0 && (
          <p className="hint">
            No fields yet. Switch to <strong>Edit form</strong> to place text,
            checkbox, date, or signature fields.
          </p>
        )}

        <div className="row-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void exportPdf(true)}
          >
            Export filled PDF
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void exportPdf(false)}
          >
            Export fillable PDF
          </button>
        </div>
      </div>

      <SignaturePad
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onSave={(dataUrl) => {
          if (signFieldId) updateField(signFieldId, { value: dataUrl });
          setSignOpen(false);
          setSignFieldId(null);
        }}
      />
    </div>
  );
}
