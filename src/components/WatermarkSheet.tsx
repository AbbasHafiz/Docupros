"use client";

import { useEffect, useMemo, useState } from "react";
import type { DocumentRecord, WatermarkLayout, WatermarkOptions } from "@/lib/types";
import {
  DEFAULT_WATERMARK_STYLE,
  DEFAULT_WATERMARK_TEXT,
  normalizeWatermark,
  resolveDocWatermark,
  watermarkTileGrid,
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
  /** Live draft for on-page look-and-feel while the sheet is open. */
  onDraftChange?: (options: WatermarkOptions | null) => void;
};

export function WatermarkSheet({
  doc,
  open,
  onClose,
  onSave,
  onDraftChange,
}: Props) {
  const existing = useMemo(() => resolveDocWatermark(doc), [doc]);
  const [text, setText] = useState(
    existing?.text ?? DEFAULT_WATERMARK_TEXT,
  );
  const [color, setColor] = useState(
    existing?.color ?? DEFAULT_WATERMARK_STYLE.color,
  );
  const [opacity, setOpacity] = useState(
    existing?.opacity ?? DEFAULT_WATERMARK_STYLE.opacity,
  );
  const [layout, setLayout] = useState<WatermarkLayout>(
    existing?.layout ?? "full",
  );
  const [angle, setAngle] = useState(
    existing?.angle ?? DEFAULT_WATERMARK_STYLE.angle,
  );
  const [size, setSize] = useState(existing?.size ?? DEFAULT_WATERMARK_STYLE.size);
  const [spacing, setSpacing] = useState(
    existing?.spacing ?? DEFAULT_WATERMARK_STYLE.spacing,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const wm = resolveDocWatermark(doc);
    setText(wm?.text ?? DEFAULT_WATERMARK_TEXT);
    setColor(wm?.color ?? DEFAULT_WATERMARK_STYLE.color);
    setOpacity(wm?.opacity ?? DEFAULT_WATERMARK_STYLE.opacity);
    setLayout(wm?.layout ?? "full");
    setAngle(wm?.angle ?? DEFAULT_WATERMARK_STYLE.angle);
    setSize(wm?.size ?? DEFAULT_WATERMARK_STYLE.size);
    setSpacing(wm?.spacing ?? DEFAULT_WATERMARK_STYLE.spacing);
    setError(null);
  }, [open, doc]);

  const preview = useMemo(
    () =>
      normalizeWatermark({
        text: text.trim() || DEFAULT_WATERMARK_TEXT,
        color,
        opacity,
        layout,
        angle,
        size,
        spacing,
      }),
    [text, color, opacity, layout, angle, size, spacing],
  );

  useEffect(() => {
    if (!open) {
      onDraftChange?.(null);
      return;
    }
    onDraftChange?.(preview);
  }, [open, preview, onDraftChange]);

  if (!open) return null;

  const previewGrid =
    preview?.layout === "full"
      ? watermarkTileGrid(preview.spacing)
      : { cols: 1, rows: 1 };
  const previewMarks =
    preview?.layout === "full"
      ? Array.from({ length: previewGrid.cols * previewGrid.rows }, (_, i) => i)
      : [0];

  const save = async (clear = false) => {
    setBusy(true);
    setError(null);
    try {
      if (clear) {
        await onSave(null);
      } else {
        // Empty text still applies the default shown in the preview
        const options = normalizeWatermark({
          text: text.trim() || DEFAULT_WATERMARK_TEXT,
          color,
          opacity,
          layout,
          angle,
          size,
          spacing,
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
      className="modal-backdrop share-backdrop watermark-sheet-backdrop"
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

        {error && <p className="share-error">{error}</p>}

        <div
          className="watermark-preview"
          aria-hidden
          style={{
            ["--wm-color" as string]: preview?.color ?? color,
            ["--wm-opacity" as string]: String(preview?.opacity ?? opacity),
            ["--wm-angle" as string]: `${preview?.angle ?? angle}deg`,
            ["--wm-size" as string]: String(preview?.size ?? size),
            ["--wm-cols" as string]: String(previewGrid.cols),
            ["--wm-rows" as string]: String(previewGrid.rows),
          }}
        >
          <div
            className={`watermark-preview-page ${
              preview?.layout === "full" ? "is-full" : ""
            }`}
          >
            {previewMarks.map((i) => (
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

        <label className="field watermark-field">
          <span>Text</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={DEFAULT_WATERMARK_TEXT}
            maxLength={80}
            disabled={busy}
          />
        </label>
        <p className="hint watermark-save-hint">
          Save applies the watermark on the page so you can check look and feel.
          Clear removes it.
        </p>

        <div className="watermark-compact-row">
          <div className="cnic-option-group watermark-group">
            <p className="subhead">Place</p>
            <div className="cnic-option-row">
              <button
                type="button"
                className={`btn-secondary watermark-chip ${layout === "center" ? "is-active-btn" : ""}`}
                disabled={busy}
                onClick={() => setLayout("center")}
              >
                Center
              </button>
              <button
                type="button"
                className={`btn-secondary watermark-chip ${layout === "full" ? "is-active-btn" : ""}`}
                disabled={busy}
                onClick={() => setLayout("full")}
              >
                Full
              </button>
            </div>
          </div>

          <div className="cnic-option-group watermark-group">
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
        </div>

        <div className="watermark-sliders">
          <label className="field watermark-field">
            <span>Size · {Math.round(size * 100)}%</span>
            <input
              type="range"
              min={0.15}
              max={2.5}
              step={0.05}
              value={size}
              disabled={busy}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>

          <label
            className={`field watermark-field ${layout !== "full" ? "is-dimmed" : ""}`}
          >
            <span>Line space · {Math.round(spacing * 100)}%</span>
            <input
              type="range"
              min={0.4}
              max={2}
              step={0.05}
              value={spacing}
              disabled={busy || layout !== "full"}
              onChange={(e) => setSpacing(Number(e.target.value))}
            />
          </label>

          <label className="field watermark-field">
            <span>Opacity · {Math.round(opacity * 100)}%</span>
            <input
              type="range"
              min={0.08}
              max={0.55}
              step={0.01}
              value={opacity}
              disabled={busy}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>

          <label className="field watermark-field">
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
        </div>

        <div className="watermark-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void save(true)}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
