"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Colleague } from "@/lib/types";
import { createId } from "@/lib/id";
import {
  deleteColleague,
  listColleagues,
  saveColleague,
} from "@/lib/storage";

export default function MePage() {
  const [colleagues, setColleagues] = useState<Colleague[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => {
    setColleagues(await listColleagues());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const add = async () => {
    const n = name.trim();
    const e = email.trim();
    const p = phone.trim();
    if (!n) {
      setStatus("Name is required");
      return;
    }
    if (!e && !p) {
      setStatus("Add an email or phone");
      return;
    }
    const now = Date.now();
    await saveColleague({
      id: createId(),
      name: n,
      email: e || undefined,
      phone: p || undefined,
      createdAt: now,
      updatedAt: now,
    });
    setName("");
    setEmail("");
    setPhone("");
    setStatus("Colleague saved");
    await refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this colleague?")) return;
    await deleteColleague(id);
    await refresh();
  };

  return (
    <main className="home">
      <section className="hero">
        <h1 className="hero-brand" style={{ fontSize: "2.2rem" }}>
          Me
        </h1>
        <p className="hero-copy">
          Docupros stores scans on this device. No account required.
        </p>
      </section>

      <div className="text-edit-box">
        <p className="subhead">Colleagues</p>
        <p className="hint">
          Save coworkers to share documents faster from any scan. Contacts stay
          on this device.
        </p>

        <div className="colleague-form" style={{ marginTop: "0.75rem" }}>
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sara Khan"
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sara@company.com"
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 300 1234567"
            />
          </label>
          <button type="button" className="btn-primary" onClick={() => void add()}>
            Add colleague
          </button>
          {status && <p className="hint">{status}</p>}
        </div>

        <div className="colleague-list" style={{ marginTop: "1rem" }}>
          {colleagues === null && <p className="muted">Loading…</p>}
          {colleagues?.length === 0 && (
            <p className="muted">No colleagues yet.</p>
          )}
          {colleagues?.map((c) => (
            <div key={c.id} className="colleague-row">
              <div className="colleague-meta">
                <strong>{c.name}</strong>
                <span>
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact"}
                </span>
              </div>
              <button
                type="button"
                className="text-btn"
                onClick={() => void remove(c.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="text-edit-box" style={{ marginTop: "1rem" }}>
        <p className="subhead">About</p>
        <p className="hint">
          Local-first CamScanner-style scanner: capture, enhance, edit, form
          fill, convert, print, share with colleagues, and lock documents in
          your browser.
        </p>
        <div className="row-actions" style={{ marginTop: "0.75rem" }}>
          <Link href="/tools" className="btn-secondary">
            Open Tools
          </Link>
          <Link href="/import" className="btn-secondary">
            Import PDF
          </Link>
        </div>
      </div>
    </main>
  );
}
