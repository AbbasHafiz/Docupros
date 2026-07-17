"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DocumentRecord } from "@/lib/types";
import { listDocuments, deleteDocument } from "@/lib/storage";
import { documentHref } from "@/lib/routes";

export function DocumentLibrary() {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null);

  const refresh = useCallback(async () => {
    const items = await listDocuments();
    setDocs(items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listDocuments().then((items) => {
      if (!cancelled) setDocs(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(id);
    await refresh();
  };

  if (docs === null) {
    return <p className="muted center-pad">Loading your scans…</p>;
  }

  if (docs.length === 0) {
    return (
      <section className="empty-library">
        <p className="empty-kicker">No documents yet</p>
        <p className="empty-copy">
          Capture a page with your camera or upload a photo to start scanning.
        </p>
        <Link href="/scan" className="btn-primary">
          Start scanning
        </Link>
      </section>
    );
  }

  return (
    <section className="library">
      <div className="library-grid">
        {docs.map((doc) => (
          <article key={doc.id} className="doc-item">
            <Link href={documentHref(doc.id)} className="doc-link">
              <div className="doc-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.thumbnail ?? doc.pages[0]?.imageDataUrl}
                  alt=""
                />
              </div>
              <div className="doc-meta">
                <h2>{doc.title}</h2>
                <p>
                  {doc.kind === "id_card"
                    ? "CNIC · "
                    : doc.kind === "pdf_form"
                      ? "PDF form · "
                      : ""}
                  {doc.pages.length} page{doc.pages.length === 1 ? "" : "s"} ·{" "}
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </p>
                {(doc.colleagueIds?.length ?? 0) > 0 && (
                  <span className="doc-colleague-tag">
                    Shared with colleague
                    {(doc.colleagueIds?.length ?? 0) > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </Link>
            <button
              type="button"
              className="doc-delete"
              onClick={() => void onDelete(doc.id)}
              aria-label={`Delete ${doc.title}`}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
