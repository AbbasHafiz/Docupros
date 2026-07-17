"use client";

import { useEffect, useState } from "react";
import type { DocumentRecord } from "@/lib/types";
import {
  canUseSystemShare,
  prepareDocumentImage,
  prepareDocumentPdf,
  shareToPlatform,
  type PreparedShare,
  type SharePlatform,
} from "@/lib/share";

type Props = {
  doc: DocumentRecord;
  open: boolean;
  onClose: () => void;
  onStatus?: (message: string | null) => void;
};

const PLATFORMS: {
  id: SharePlatform;
  label: string;
  icon: string;
  hint: string;
}[] = [
  {
    id: "system",
    label: "More apps",
    icon: "↗",
    hint: "WhatsApp, Drive, Files…",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: "WA",
    hint: "Chat or status",
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: "TG",
    hint: "Send as file",
  },
  {
    id: "email",
    label: "Email",
    icon: "✉",
    hint: "Gmail, Outlook…",
  },
  {
    id: "sms",
    label: "Messages",
    icon: "💬",
    hint: "SMS / iMessage",
  },
  {
    id: "image",
    label: "As image",
    icon: "🖼",
    hint: "First page JPEG",
  },
  {
    id: "download",
    label: "Download PDF",
    icon: "↓",
    hint: "Save then share",
  },
];

export function ShareSheet({ doc, open, onClose, onStatus }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedShare | null>(null);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrepared(null);
      setError(null);
      setBusy(false);
      return;
    }

    let cancelled = false;
    setBusy(true);
    setError(null);
    setHasNativeShare(canUseSystemShare());

    void prepareDocumentPdf(doc)
      .then((p) => {
        if (cancelled) return;
        setPrepared(p);
        setHasNativeShare(canUseSystemShare([p.file]) || canUseSystemShare());
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not prepare share");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, doc]);

  if (!open) return null;

  const runShare = async (platform: SharePlatform) => {
    setError(null);
    setBusy(true);
    onStatus?.("Preparing…");
    try {
      let payload = prepared;
      if (platform === "image") {
        payload = await prepareDocumentImage(doc);
      } else if (!payload) {
        payload = await prepareDocumentPdf(doc);
        setPrepared(payload);
      }

      const result = await shareToPlatform(platform, payload);
      if (result === "shared") {
        onStatus?.("Shared");
        onClose();
      } else if (result === "downloaded") {
        onStatus?.(
          platform === "download"
            ? "PDF downloaded"
            : "PDF saved — finish sharing in the opened app",
        );
        if (platform === "download") onClose();
      }
      // aborted → stay open
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
      onStatus?.(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop share-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal-sheet share-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
      >
        <div className="modal-head">
          <h2 id="share-sheet-title">Share document</h2>
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
          {busy && !prepared
            ? "Building PDF…"
            : hasNativeShare
              ? "Pick an app — PDF attaches automatically on most phones."
              : "Download the PDF, then attach it in WhatsApp, email, or Drive."}
        </p>

        {error && <p className="share-error">{error}</p>}

        <div className="share-grid" role="list">
          {PLATFORMS.filter((p) => p.id !== "system" || hasNativeShare).map(
            (p) => (
              <button
                key={p.id}
                type="button"
                className="share-tile"
                role="listitem"
                disabled={busy || (!prepared && p.id !== "image")}
                onClick={() => void runShare(p.id)}
              >
                <span className="share-tile-icon" aria-hidden>
                  {p.icon}
                </span>
                <span className="share-tile-label">{p.label}</span>
                <span className="share-tile-hint">{p.hint}</span>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
