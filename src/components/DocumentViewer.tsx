"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "./AppHeader";
import type { DocumentRecord } from "@/lib/types";
import { deleteDocument, getDocument, saveDocument } from "@/lib/storage";
import { downloadBlob, exportDocumentPdf, printDocumentPages } from "@/lib/pdf";
import { extractTextFromImages } from "@/lib/ocr";
import { rebuildDocumentText } from "@/lib/editOperations";
import { exportIdCardPdf, printIdCard } from "@/lib/idPrint";
import { hashPassword } from "@/lib/toolsOps";
import { documentHref } from "@/lib/routes";

type Props = { id: string };

function withUpdate(
  doc: DocumentRecord,
  patch: Partial<DocumentRecord>,
): DocumentRecord {
  return { ...doc, ...patch, updatedAt: Date.now() };
}

export function DocumentViewer({ id }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentRecord | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [lockInput, setLockInput] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showOcr, setShowOcr] = useState(false);
  const [ocrDraft, setOcrDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getDocument(id).then((d) => {
      if (cancelled) return;
      setDoc(d ?? null);
      if (d?.ocrText) {
        setOcrDraft(d.ocrText);
        setShowOcr(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (doc === undefined) {
    return <div className="center-pad muted">Loading…</div>;
  }

  if (!doc) {
    return (
      <div className="center-pad">
        <p className="muted">Document not found.</p>
        <Link href="/" className="btn-primary">
          Back to library
        </Link>
      </div>
    );
  }

  if (doc.locked && doc.lockHash && !unlocked) {
    return (
      <div className="center-pad">
        <p className="empty-kicker">Locked</p>
        <p className="muted">{doc.title}</p>
        <label className="field" style={{ maxWidth: 280, width: "100%" }}>
          <span>Password</span>
          <input
            type="password"
            value={lockInput}
            onChange={(e) => setLockInput(e.target.value)}
          />
        </label>
        {lockError && <p className="hint">{lockError}</p>}
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            void (async () => {
              const h = await hashPassword(lockInput);
              if (h === doc.lockHash) {
                setUnlocked(true);
                setLockError(null);
              } else setLockError("Wrong password");
            })()
          }
        >
          Unlock
        </button>
        <Link href="/" className="text-btn">
          Back
        </Link>
      </div>
    );
  }

  const isId = doc.kind === "id_card";
  const front =
    doc.pages.find((p) => p.side === "front") ?? doc.pages[0] ?? null;
  const back = doc.pages.find((p) => p.side === "back") ?? null;
  const activePage = doc.pages[active];

  const persist = async (updated: DocumentRecord) => {
    await saveDocument(updated);
    setDoc(updated);
  };

  const rename = async () => {
    const title = prompt("Document title", doc.title);
    if (!title?.trim()) return;
    await persist(withUpdate(doc, { title: title.trim() }));
  };

  const setWatermark = async () => {
    const text = prompt("Watermark text (blank to clear)", doc.watermark ?? "");
    if (text === null) return;
    await persist(
      withUpdate(doc, { watermark: text.trim() || undefined }),
    );
  };

  const exportPdf = async (a4 = false) => {
    setBusy(true);
    try {
      if (isId && front) {
        const blob = await exportIdCardPdf({
          front: front.imageDataUrl,
          back: back?.imageDataUrl,
          title: doc.title,
          copies: 1,
          watermark: doc.watermark,
        });
        if (blob.size < 500) throw new Error("PDF export produced an empty file");
        downloadBlob(
          blob,
          `${doc.title.replace(/\s+/g, "-").toLowerCase()}-id.pdf`,
        );
      } else {
        const pages = doc.pages
          .map((p) => p.imageDataUrl)
          .filter((src) => Boolean(src));
        if (!pages.length) throw new Error("No page images to export");
        const blob = await exportDocumentPdf(doc.title, pages, {
          watermark: doc.watermark,
          a4,
        });
        if (blob.size < 500) throw new Error("PDF export produced an empty file");
        downloadBlob(
          blob,
          `${doc.title.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setBusy(false);
    }
  };

  const doPrint = async () => {
    setBusy(true);
    try {
      if (isId && front) {
        await printIdCard({
          front: front.imageDataUrl,
          back: back?.imageDataUrl,
          title: doc.title,
          copies: 1,
          watermark: doc.watermark,
        });
      } else {
        await printDocumentPages(
          doc.pages.map((p) => p.imageDataUrl),
          doc.title,
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Print failed");
    } finally {
      setBusy(false);
    }
  };

  const printIdTwice = async () => {
    if (!front) return;
    setBusy(true);
    try {
      await printIdCard({
        front: front.imageDataUrl,
        back: back?.imageDataUrl,
        title: doc.title,
        copies: 2,
        watermark: doc.watermark,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Print failed");
    } finally {
      setBusy(false);
    }
  };

  const runOcr = async () => {
    setOcrRunning(true);
    setOcrProgress(0);
    try {
      const text = await extractTextFromImages(
        doc.pages.map((p) => p.imageDataUrl),
        setOcrProgress,
      );
      const updated = withUpdate(doc, { ocrText: text });
      await persist(updated);
      setOcrDraft(text);
      setShowOcr(true);
    } finally {
      setOcrRunning(false);
    }
  };

  const saveOcrText = async () => {
    const pages = doc.pages.map((p, i) =>
      i === active ? { ...p, ocrText: ocrDraft } : p,
    );
    await persist(
      withUpdate(doc, {
        pages,
        ocrText: ocrDraft.includes("— Page")
          ? ocrDraft
          : rebuildDocumentText(
              doc.pages.map((p, i) => (i === active ? ocrDraft : p.ocrText)),
            ) || ocrDraft,
      }),
    );
  };

  const copyText = async () => {
    const text = ocrDraft || doc.ocrText || "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const movePage = async (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= doc.pages.length) return;
    const pages = [...doc.pages];
    const [item] = pages.splice(from, 1);
    pages.splice(to, 0, item);
    await persist(
      withUpdate(doc, {
        pages,
        thumbnail: pages[0]?.imageDataUrl,
      }),
    );
    setActive(to);
  };

  const deletePage = async (index: number) => {
    if (doc.pages.length <= 1) {
      alert("A document needs at least one page.");
      return;
    }
    if (!confirm("Delete this page?")) return;
    const pages = doc.pages.filter((_, i) => i !== index);
    await persist(
      withUpdate(doc, {
        pages,
        thumbnail: pages[0]?.imageDataUrl,
      }),
    );
    setActive(Math.min(index, pages.length - 1));
  };

  const remove = async () => {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(doc.id);
    startTransition(() => router.push("/"));
  };

  return (
    <div className="doc-view">
      <AppHeader
        title={doc.title}
        backHref="/"
        action={
          <button type="button" className="text-btn" onClick={() => void rename()}>
            Rename
          </button>
        }
      />

      {isId && (
        <div className="id-banner soft">
          ID card · Front{back ? " + Back" : ""} ready for print
        </div>
      )}

      <div className="doc-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activePage?.imageDataUrl}
          alt={`Page ${active + 1}`}
          className="doc-page-image"
        />
      </div>

      {doc.pages.length > 1 && (
        <div className="page-strip compact">
          {doc.pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`page-thumb-btn ${i === active ? "is-active" : ""}`}
              onClick={() => {
                setActive(i);
                setOcrDraft(p.ocrText || doc.ocrText || "");
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageDataUrl}
                alt={p.side ?? `Page ${i + 1}`}
              />
            </button>
          ))}
        </div>
      )}

      <div className="doc-toolbar">
        <Link
          href={documentHref(doc.id, "edit", activePage?.id ?? "")}
          className="btn-primary"
        >
          Edit page
        </Link>
        <Link
          href={
            doc.kind === "pdf_form" && doc.sourcePdfBase64
              ? documentHref(doc.id, "pdf-form")
              : documentHref(doc.id, "form")
          }
          className="btn-secondary"
        >
          Form fill
        </Link>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void doPrint()}
          disabled={busy}
        >
          {isId ? "ID Print" : "Print"}
        </button>
        {isId && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void printIdTwice()}
            disabled={busy}
          >
            Print ×2
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void exportPdf(isId ? false : true)}
          disabled={busy}
        >
          Export PDF
        </button>
        <Link
          href={`/scan?append=${doc.id}${isId ? "&mode=id_card" : ""}`}
          className="btn-secondary"
        >
          {isId ? "Rescan side" : "Add page"}
        </Link>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setManage((v) => !v)}
        >
          Pages
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void setWatermark()}
        >
          Watermark
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void runOcr()}
          disabled={ocrRunning}
        >
          {ocrRunning ? `OCR ${ocrProgress}%` : "Extract text"}
        </button>
        <button type="button" className="btn-danger" onClick={() => void remove()}>
          Delete
        </button>
      </div>

      {manage && (
        <section className="manage-panel">
          <h2>Manage pages</h2>
          <ul className="manage-list">
            {doc.pages.map((p, i) => (
              <li key={p.id}>
                <span>
                  {p.side
                    ? p.side === "front"
                      ? "Front"
                      : "Back"
                    : `Page ${i + 1}`}
                </span>
                <div className="row-actions">
                  <button
                    type="button"
                    className="text-btn"
                    disabled={i === 0}
                    onClick={() => void movePage(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    disabled={i === doc.pages.length - 1}
                    onClick={() => void movePage(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => void deletePage(i)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(showOcr || doc.ocrText) && (
        <section className="ocr-panel">
          <div className="ocr-head">
            <h2>Document text</h2>
            <div className="row-actions">
              <button
                type="button"
                className="text-btn"
                onClick={() => void copyText()}
              >
                Copy
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setShowOcr((v) => !v)}
              >
                {showOcr ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {showOcr && (
            <>
              <textarea
                className="ocr-text"
                value={ocrDraft}
                onChange={(e) => setOcrDraft(e.target.value)}
                rows={10}
                placeholder="Extracted text appears here — edit freely, then save."
              />
              <div className="row-actions" style={{ marginTop: "0.65rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void saveOcrText()}
                >
                  Save text changes
                </button>
                <Link
                  href={documentHref(doc.id, "edit", activePage?.id ?? "")}
                  className="btn-secondary"
                >
                  Change text on image
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
