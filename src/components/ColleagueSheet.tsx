"use client";

import { useEffect, useState } from "react";
import type { Colleague, DocumentRecord } from "@/lib/types";
import { createId } from "@/lib/id";
import {
  deleteColleague,
  listColleagues,
  saveColleague,
  saveDocument,
} from "@/lib/storage";
import {
  prepareDocumentPdf,
  shareToColleague,
  type PreparedShare,
} from "@/lib/share";

type Props = {
  doc: DocumentRecord;
  open: boolean;
  onClose: () => void;
  onDocUpdate?: (doc: DocumentRecord) => void;
  onStatus?: (message: string | null) => void;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  note: string;
};

const emptyForm: FormState = { name: "", email: "", phone: "", note: "" };

export function ColleagueSheet({
  doc,
  open,
  onClose,
  onDocUpdate,
  onStatus,
}: Props) {
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [prepared, setPrepared] = useState<PreparedShare | null>(null);

  const refresh = async () => {
    const items = await listColleagues();
    setColleagues(items);
  };

  useEffect(() => {
    if (!open) {
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setError(null);
      setPrepared(null);
      setBusy(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all([listColleagues(), prepareDocumentPdf(doc)])
      .then(([items, pdf]) => {
        if (cancelled) return;
        setColleagues(items);
        setPrepared(pdf);
        if (items.length === 0) setShowForm(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load colleagues");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, doc]);

  if (!open) return null;

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  };

  const startEdit = (c: Colleague) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      note: c.note ?? "",
    });
    setShowForm(true);
    setError(null);
  };

  const saveForm = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    if (!email && !phone) {
      setError("Add an email or phone number");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const now = Date.now();
      const existing = editingId
        ? colleagues.find((c) => c.id === editingId)
        : null;
      const next: Colleague = {
        id: existing?.id ?? createId(),
        name,
        email: email || undefined,
        phone: phone || undefined,
        note: form.note.trim() || undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await saveColleague(next);
      await refresh();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      onStatus?.(existing ? "Colleague updated" : "Colleague saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save colleague");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this colleague?")) return;
    setBusy(true);
    try {
      await deleteColleague(id);
      await refresh();
      onStatus?.("Colleague removed");
    } finally {
      setBusy(false);
    }
  };

  const markShared = async (colleagueId: string) => {
    const ids = new Set(doc.colleagueIds ?? []);
    ids.add(colleagueId);
    const updated: DocumentRecord = {
      ...doc,
      colleagueIds: [...ids],
      updatedAt: Date.now(),
    };
    await saveDocument(updated);
    onDocUpdate?.(updated);
  };

  const sendTo = async (
    colleague: Colleague,
    channel: "auto" | "email" | "whatsapp" | "system" = "auto",
  ) => {
    setBusy(true);
    setError(null);
    onStatus?.(`Sharing with ${colleague.name}…`);
    try {
      const payload = prepared ?? (await prepareDocumentPdf(doc));
      if (!prepared) setPrepared(payload);
      const result = await shareToColleague(colleague, payload, channel);
      await markShared(colleague.id);
      if (result === "shared") {
        onStatus?.(`Shared with ${colleague.name}`);
        onClose();
      } else if (result === "downloaded") {
        onStatus?.(
          `PDF ready — finish sending to ${colleague.name} in the opened app`,
        );
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Share failed");
        onStatus?.(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const linked = new Set(doc.colleagueIds ?? []);

  return (
    <div
      className="modal-backdrop share-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal-sheet share-sheet colleague-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="colleague-sheet-title"
      >
        <div className="modal-head">
          <h2 id="colleague-sheet-title">Share with colleague</h2>
          <button
            type="button"
            className="text-btn"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <p className="share-doc-title">{doc.title || "Untitled"}</p>
        <p className="hint share-hint">
          Save coworkers here, then send this PDF by email or WhatsApp. Contacts
          stay on this device only.
        </p>

        {error && <p className="share-error">{error}</p>}

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="colleague-list" role="list">
              {colleagues.map((c) => (
                <div key={c.id} className="colleague-row" role="listitem">
                  <div className="colleague-meta">
                    <strong>
                      {c.name}
                      {linked.has(c.id) ? (
                        <span className="colleague-badge">Shared</span>
                      ) : null}
                    </strong>
                    <span>
                      {[c.email, c.phone].filter(Boolean).join(" · ") ||
                        "No contact"}
                    </span>
                  </div>
                  <div className="colleague-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy}
                      onClick={() => void sendTo(c, "auto")}
                    >
                      Send
                    </button>
                    {c.email && (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => void sendTo(c, "email")}
                        title="Email"
                      >
                        ✉
                      </button>
                    )}
                    {c.phone && (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => void sendTo(c, "whatsapp")}
                        title="WhatsApp"
                      >
                        WA
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-btn"
                      disabled={busy}
                      onClick={() => startEdit(c)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-btn"
                      disabled={busy}
                      onClick={() => void remove(c.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {colleagues.length === 0 && !showForm && (
                <p className="muted">No colleagues yet. Add one to share.</p>
              )}
            </div>

            {!showForm ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={startAdd}
                disabled={busy}
              >
                + Add colleague
              </button>
            ) : (
              <div className="colleague-form">
                <p className="subhead">
                  {editingId ? "Edit colleague" : "New colleague"}
                </p>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Sara Khan"
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="sara@company.com"
                    autoComplete="email"
                  />
                </label>
                <label className="field">
                  <span>Phone (WhatsApp)</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="+92 300 1234567"
                    autoComplete="tel"
                  />
                </label>
                <label className="field">
                  <span>Note</span>
                  <input
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </label>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void saveForm()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setForm(emptyForm);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
