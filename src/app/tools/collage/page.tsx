"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CollageEditor } from "@/components/CollageEditor";
import { DocPicker } from "@/components/DocPicker";
import { createId } from "@/lib/id";
import { readFilesAsDataUrls } from "@/lib/collage";
import { documentHref } from "@/lib/routes";
import { getDocument, saveDocument } from "@/lib/storage";
import type { DocumentRecord, ScanPage } from "@/lib/types";

function CollagePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const docId = params.get("id");
  const [, startTransition] = useTransition();

  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"pick" | "edit">("pick");
  const [title, setTitle] = useState("Collage");

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    void getDocument(docId).then((d) => {
      if (cancelled || !d) return;
      setDoc(d);
      setTitle(`${d.title} collage`);
      const srcs = d.pages.map((p) => p.imageDataUrl).filter(Boolean);
      setSources(srcs);
      if (srcs.length >= 2) setMode("edit");
    });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const canEdit = sources.length >= 2;

  const fromPicker = (docs: DocumentRecord[]) => {
    const d = docs[0];
    if (!d) return;
    setDoc(d);
    setTitle(`${d.title} collage`);
    const srcs = d.pages.map((p) => p.imageDataUrl).filter(Boolean);
    setSources(srcs);
    if (srcs.length < 2) {
      alert("Pick a document with at least 2 pages, or upload images below.");
      return;
    }
    setMode("edit");
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = await readFilesAsDataUrls(files);
      if (urls.length < 2) {
        alert("Select at least 2 images for a collage.");
        return;
      }
      setDoc(null);
      setSources(urls);
      setTitle("Collage");
      setMode("edit");
    } finally {
      setBusy(false);
    }
  };

  const saveCollage = async (dataUrl: string) => {
    setBusy(true);
    try {
      const page: ScanPage = {
        id: createId(),
        imageDataUrl: dataUrl,
        originalDataUrl: dataUrl,
        filter: "original",
        createdAt: Date.now(),
      };
      const now = Date.now();
      let saved: DocumentRecord;
      if (doc) {
        saved = {
          ...doc,
          pages: [...doc.pages, page],
          thumbnail: doc.thumbnail ?? dataUrl,
          updatedAt: now,
          title: doc.title,
        };
      } else {
        saved = {
          id: createId(),
          title: title.trim() || "Collage",
          pages: [page],
          createdAt: now,
          updatedAt: now,
          thumbnail: dataUrl,
          kind: "document",
        };
      }
      await saveDocument(saved);
      startTransition(() => router.push(documentHref(saved.id)));
    } finally {
      setBusy(false);
    }
  };

  const heading = useMemo(() => {
    if (mode === "edit") return "Adjust collage";
    return "Collage";
  }, [mode]);

  return (
    <main className="home collage-page">
      <AppHeader
        title={heading}
        backHref={mode === "edit" && !docId ? undefined : "/tools"}
        action={
          mode === "edit" ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (docId && doc) {
                  startTransition(() => router.push(documentHref(doc.id)));
                } else {
                  setMode("pick");
                  setSources([]);
                }
              }}
            >
              Back
            </button>
          ) : null
        }
      />

      {mode === "pick" && (
        <>
          <p className="hint" style={{ margin: "1rem 0" }}>
            Put multiple images on one page, then drag and resize each one —
            like a photo collage from one scan session.
          </p>

          <label className="field">
            <span>Collage title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div className="collage-upload">
            <label className="btn-primary collage-upload-btn">
              Upload images
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void onUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="hint">Or choose a document with 2+ pages</p>
          </div>

          {busy && <p className="busy-bar">Loading…</p>}

          <div style={{ marginTop: "1rem" }}>
            <DocPicker onSelect={(d) => fromPicker(d)} />
          </div>
        </>
      )}

      {mode === "edit" && canEdit && (
        <CollageEditor
          sources={sources}
          busy={busy}
          onCancel={() => {
            if (docId && doc) {
              startTransition(() => router.push(documentHref(doc.id)));
            } else {
              setMode("pick");
            }
          }}
          onSave={saveCollage}
        />
      )}

      {mode === "edit" && !canEdit && (
        <p className="muted center-pad">Need at least 2 images for a collage.</p>
      )}
    </main>
  );
}

export default function CollagePage() {
  return (
    <Suspense fallback={<div className="center-pad muted">Opening collage…</div>}>
      <CollagePageInner />
    </Suspense>
  );
}
