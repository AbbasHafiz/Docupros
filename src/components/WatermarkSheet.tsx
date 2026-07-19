"use client";

import { useEffect, useMemo, useState } from "react";
import type { DocumentRecord, WatermarkLayout, WatermarkOptions } from "@/lib/types";
import {
  DEFAULT_WATERMARK_STYLE,
  normalizeWatermark,
  resolveDocWatermark,
} from "@/lib/watermark";

const PRESET_COLORS = [
  "#0f766e",
  "#0f172a",
  "#b91c1c",
  "#1d4ed8",
  "#a16207",
  "#6b7280",
] as const;

type Props = {
  doc: DocumentRecord;
  open: boolean;
  onClose: () => void;
  onSave: (options: WatermarkOptions | null) => Promise<void> | void;
};

export function WatermarkSheet({ doc, open, onClose, onSave }: Props) {
  const existing = useMemo(() => resolveDocWatermark(doc), [doc]);
  const [text, setText] = useState(existing?.text ?? "");
  const [color, setColor] = useState(
    existing?.color ?? DEFAULT_WATERMARK_STYLE.color,
  );
  const [opacity, setOpacity] = useState(
    existing?.opacity ?? DEFAULT_WATERMARK_STYLE.opacity,
  );
  const [layout, setLayout] = useState<WatermarkLayout>(
    existing?.layout ?? "center",
  );
  const [angle, setAngle] = useState(
    existing?.angle ?? DEFAULT_WATERMARK_STYLE.angle,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const wm = resolveDocWatermark(doc);
    setText(wm?.text ?? "");
    setColor(wm?.color ?? DEFAULT_WATERMARK_STYLE.color);
    setOpacity(wm?.opacity ?? DEFAULT_WATERMARK_STYLE.opacity);
    setLayout(wm?.layout ?? "center");
    setAngle(wm?.angle ?? DEFAULT_WATERMARK_STYLE.angle);
    setError(null);
  }, [open, doc]);

  if (!open) return null;

  const preview = normalizeWatermark({
    text: text.trim() || "WATERMARK",
    color,
    opacity,
    layout,
    angle,
  });

  const save = async (clear = false) => {
    setBusy(true);
    setError(null);
    try {
      if (clear || !text.trim()) {
        await onSave(null);
      } else {
        const options = normalizeWatermark({
          text,
          color,
          opacity,
          layout,
          angle,
        });
        if (!options) throw new Error("Enter watermark text");
        await onSave(options);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save watermark");
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
        className="modal-sheet share-sheet watermark-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="watermark-title"
      >
        <div className="modal-head">
          <h2 id="watermark-title">Watermark</h2>
          <button
            type="button"
            className="text-btn"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <p className="hint share-hint">
          Applied on PDF export, share, and CNIC print. Choose full-page tiling
          or a single center mark, plus color and strength.
        </p>

        {error && <p className="share-error">{error}</p>}

        <label className="field">
          <span>Text</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. CONFIDENTIAL"
            maxLength={80}
            disabled={busy}
          />
        </label>

        <div className="cnic-option-group">
          <p className="subhead">Placement</p>
          <div className="cnic-option-row">
            <button
              type="button"
              className={`btn-secondary ${layout === "center" ? "is-active-btn" : ""}`}
              disabled={busy}
              onClick={() => setLayout("center")}
            >
              Center
            </button>
            <button
              type="button"
              className={`btn-secondary ${layout === "full" ? "is-active-btn" : ""}`}
              disabled={busy}
              onClick={() => setLayout("full")}
            >
              Full page
            </button>
          </div>
        </div>

        <div className="cnic-option-group">
          <p className="subhead">Color</p>
          <div className="watermark-color-row">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`watermark-swatch ${color === c ? "is-active" : ""}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                disabled={busy}
                onClick={() => setColor(c)}
              />
            ))}
            <label className="watermark-custom-color" title="Custom color">
              <input
                type="color"
                value={color.startsWith("#") ? color : "#0f766e"}
                disabled={busy}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
        </div>

        <label className="field">
          <span>Opacity · {Math.round(opacity * 100)}%</span>
          <input
            type="range"
            min={0.05}
            max={0.45}
            step={0.01}
            value={opacity}
            disabled={busy}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span>Angle · {angle}°</span>
          <input
            type="range"
            min={-60}
            max={60}
            step={1}
            value={angle}
            disabled={busy}
            onChange={(e) => setAngle(Number(e.target.value))}
          />
        </label>

        <div
          className="watermark-preview"
          aria-hidden
          style={{
            ["--wm-color" as string]: preview?.color ?? color,
            ["--wm-opacity" as string]: String(preview?.opacity ?? opacity),
            ["--wm-angle" as string]: `${preview?.angle ?? angle}deg`,
          }}
        >
          <div className="watermark-preview-page">
            {(preview?.layout === "full"
              ? Array.from({ length: 12 }, (_, i) => i)
              : [0]
            ).map((i) => (
              <span
                key={i}
                className={`watermark-preview-mark ${
                  preview?.layout === "full" ? "is-tiled" : "is-center"
                }`}
              >
                {preview?.text ?? "WATERMARK"}
              </span>
            ))}
          </div>
        </div>

        <div className="step-actions stacked" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            {busy ? "Saving…" : "Save watermark"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void save(true)}
          >
            Clear watermark
          </button>
        </div>
      </div>
    </div>
  );
}
