"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DocumentRecord } from "@/lib/types";
import { listDocuments } from "@/lib/storage";

type Props = {
  multiple?: boolean;
  onSelect: (docs: DocumentRecord[]) => void;
  filter?: (doc: DocumentRecord) => boolean;
};

export function DocPicker({ multiple, onSelect, filter }: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void listDocuments().then((items) => {
      if (cancelled) return;
      setDocs(filter ? items.filter(filter) : items);
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const toggle = (id: string) => {
    if (!multiple) {
      const doc = docs.find((d) => d.id === id);
      if (doc) onSelect([doc]);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!docs.length) {
    return (
      <p className="hint">
        No documents yet. <Link href="/scan">Scan one</Link> first.
      </p>
    );
  }

  return (
    <div className="doc-picker">
      <ul className="manage-list">
        {docs.map((d) => (
          <li key={d.id}>
            <label className="picker-row">
              {multiple && (
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                />
              )}
              <button
                type="button"
                className="picker-main"
                onClick={() => toggle(d.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.thumbnail ?? d.pages[0]?.imageDataUrl} alt="" />
                <span>
                  <strong>{d.title}</strong>
                  <em>
                    {d.pages.length} page{d.pages.length === 1 ? "" : "s"}
                  </em>
                </span>
              </button>
            </label>
          </li>
        ))}
      </ul>
      {multiple && (
        <button
          type="button"
          className="btn-primary"
          disabled={selected.size === 0}
          onClick={() =>
            onSelect(docs.filter((d) => selected.has(d.id)))
          }
        >
          Continue ({selected.size})
        </button>
      )}
    </div>
  );
}
