"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { getDocument, saveDocument } from "@/lib/storage";
import { hashPassword } from "@/lib/toolsOps";
import type { DocumentRecord } from "@/lib/types";

export default function LockPage() {
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lock = async () => {
    if (!doc || !password.trim()) return;
    setBusy(true);
    try {
      const lockHash = await hashPassword(password.trim());
      const updated = {
        ...doc,
        lockHash,
        locked: true,
        updatedAt: Date.now(),
      };
      await saveDocument(updated);
      setDoc(updated);
      setPassword("");
      setStatus("Document locked. Password required to open.");
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      const updated = {
        ...doc,
        locked: false,
        lockHash: undefined,
        updatedAt: Date.now(),
      };
      await saveDocument(updated);
      setDoc(updated);
      setStatus("Lock removed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="Lock" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        App-level lock (password gate in Docupros). PDF encryption is not applied
        to the exported file yet.
      </p>
      {!doc ? (
        <DocPicker
          onSelect={async (docs) => {
            const fresh = await getDocument(docs[0].id);
            setDoc(fresh ?? docs[0]);
          }}
        />
      ) : (
        <div className="panel-stack">
          <p>
            <strong>{doc.title}</strong>{" "}
            {doc.locked ? "(currently locked)" : "(unlocked)"}
          </p>
          {!doc.locked ? (
            <>
              <label className="field">
                <span>New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !password.trim()}
                onClick={() => void lock()}
              >
                Lock document
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void unlock()}
            >
              Remove lock
            </button>
          )}
          <button
            type="button"
            className="text-btn"
            onClick={() => setDoc(null)}
          >
            Choose another
          </button>
          {status && <p className="busy-bar">{status}</p>}
        </div>
      )}
    </main>
  );
}
