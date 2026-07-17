"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLLAGE_PAGE_SIZES,
  COLLAGE_PRESETS,
  layoutCollagePreset,
  normalizeCollageItem,
  renderCollage,
  suggestPreset,
  type CollageItem,
  type CollagePageSize,
  type CollagePresetId,
} from "@/lib/collage";

type Props = {
  sources: string[];
  onSave: (dataUrl: string) => void | Promise<void>;
  onCancel?: () => void;
  busy?: boolean;
};

type DragMode =
  | { kind: "move"; id: string; ox: number; oy: number; start: CollageItem }
  | {
      kind: "resize";
      id: string;
      corner: "br" | "bl" | "tr" | "tl";
      start: CollageItem;
      ox: number;
      oy: number;
    };

export function CollageEditor({ sources, onSave, onCancel, busy }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<CollageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState<CollagePageSize>(COLLAGE_PAGE_SIZES[0]);
  const [preset, setPreset] = useState<CollagePresetId>("stack2");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const dragRef = useRef<DragMode | null>(null);

  useEffect(() => {
    if (!sources.length) {
      setItems([]);
      return;
    }
    const nextPreset = suggestPreset(sources.length);
    setPreset(nextPreset);
    const laid = layoutCollagePreset(sources, nextPreset);
    setItems(laid);
    setSelectedId(laid[0]?.id ?? null);
  }, [sources]);

  const applyPreset = (id: CollagePresetId) => {
    setPreset(id);
    const srcs = items.map((i) => i.src);
    const laid = layoutCollagePreset(srcs.length ? srcs : sources, id);
    setItems(laid);
    setSelectedId(laid[0]?.id ?? null);
  };

  const clientToNorm = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / Math.max(1, rect.width),
      y: (clientY - rect.top) / Math.max(1, rect.height),
    };
  };

  const onPointerDownMove = (e: React.PointerEvent, item: CollageItem) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedId(item.id);
    const p = clientToNorm(e.clientX, e.clientY);
    dragRef.current = {
      kind: "move",
      id: item.id,
      ox: p.x - item.x,
      oy: p.y - item.y,
      start: item,
    };
  };

  const onPointerDownResize = (
    e: React.PointerEvent,
    item: CollageItem,
    corner: "br" | "bl" | "tr" | "tl",
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedId(item.id);
    const p = clientToNorm(e.clientX, e.clientY);
    dragRef.current = {
      kind: "resize",
      id: item.id,
      corner,
      start: item,
      ox: p.x,
      oy: p.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = clientToNorm(e.clientX, e.clientY);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== drag.id) return item;
        if (drag.kind === "move") {
          return normalizeCollageItem({
            ...item,
            x: p.x - drag.ox,
            y: p.y - drag.oy,
          });
        }
        const s = drag.start;
        let x = s.x;
        let y = s.y;
        let w = s.w;
        let h = s.h;
        const dx = p.x - drag.ox;
        const dy = p.y - drag.oy;
        if (drag.corner === "br") {
          w = s.w + dx;
          h = s.h + dy;
        } else if (drag.corner === "bl") {
          x = s.x + dx;
          w = s.w - dx;
          h = s.h + dy;
        } else if (drag.corner === "tr") {
          y = s.y + dy;
          w = s.w + dx;
          h = s.h - dy;
        } else {
          x = s.x + dx;
          y = s.y + dy;
          w = s.w - dx;
          h = s.h - dy;
        }
        return normalizeCollageItem({ ...item, x, y, w, h });
      }),
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const moveSelected = (dx: number, dy: number) => {
    if (!selectedId) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedId
          ? normalizeCollageItem({
              ...item,
              x: item.x + dx,
              y: item.y + dy,
            })
          : item,
      ),
    );
  };

  const scaleSelected = (factor: number) => {
    if (!selectedId) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedId) return item;
        const w = item.w * factor;
        const h = item.h * factor;
        const x = item.x - (w - item.w) / 2;
        const y = item.y - (h - item.h) / 2;
        return normalizeCollageItem({ ...item, x, y, w, h });
      }),
    );
  };

  const removeSelected = () => {
    if (!selectedId || items.length <= 1) return;
    const next = items.filter((i) => i.id !== selectedId);
    setItems(next);
    setSelectedId(next[0]?.id ?? null);
  };

  const swapWithNext = () => {
    if (!selectedId || items.length < 2) return;
    const idx = items.findIndex((i) => i.id === selectedId);
    if (idx < 0) return;
    const j = (idx + 1) % items.length;
    setItems((prev) => {
      const copy = [...prev];
      const a = copy[idx];
      const b = copy[j];
      copy[idx] = { ...a, src: b.src };
      copy[j] = { ...b, src: a.src };
      return copy;
    });
  };

  const save = async () => {
    if (!items.length) return;
    setSaving(true);
    setStatus("Rendering collage…");
    try {
      const dataUrl = await renderCollage(items, page);
      await onSave(dataUrl);
      setStatus("Saved");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const aspect = page.width / page.height;

  return (
    <div className="collage-editor">
      <div className="collage-toolbar">
        <label className="field collage-field">
          <span>Page</span>
          <select
            value={page.label}
            onChange={(e) => {
              const next =
                COLLAGE_PAGE_SIZES.find((p) => p.label === e.target.value) ??
                COLLAGE_PAGE_SIZES[0];
              setPage(next);
            }}
          >
            {COLLAGE_PAGE_SIZES.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <div className="collage-presets" role="toolbar" aria-label="Layouts">
          {COLLAGE_PRESETS.filter((p) => items.length >= p.min).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn-secondary ${preset === p.id ? "is-active-btn" : ""}`}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
        </div>
      </div>

      <p className="hint collage-hint">
        Drag images to move. Use corner handles to resize. Tap an image, then
        use + / − to scale.
      </p>

      <div
        className="collage-stage-wrap"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={stageRef}
          className="collage-stage"
          style={{ aspectRatio: `${aspect}` }}
          onPointerDown={() => setSelectedId(null)}
        >
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <div
                key={item.id}
                className={`collage-item ${selected ? "is-selected" : ""}`}
                style={{
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  width: `${item.w * 100}%`,
                  height: `${item.h * 100}%`,
                }}
                onPointerDown={(e) => onPointerDownMove(e, item)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt="" draggable={false} />
                {selected && (
                  <>
                    {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                      <span
                        key={corner}
                        className={`collage-handle collage-handle-${corner}`}
                        onPointerDown={(e) =>
                          onPointerDownResize(e, item, corner)
                        }
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="collage-adjust">
        <button
          type="button"
          className="btn-secondary"
          disabled={!selectedId}
          onClick={() => moveSelected(0, -0.02)}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!selectedId}
          onClick={() => moveSelected(0, 0.02)}
        >
          ↓
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!selectedId}
          onClick={() => moveSelected(-0.02, 0)}
        >
          ←
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!selectedId}
          onClick={() => moveSelected(0.02, 0)}
        >
          →
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!selectedId}
          onClick={() => scaleSelected(1.08)}
        >
          +
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!selectedId}
          onClick={() => scaleSelected(1 / 1.08)}
        >
          −
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!selectedId || items.length < 2}
          onClick={swapWithNext}
        >
          Swap
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={!selectedId || items.length <= 1}
          onClick={removeSelected}
        >
          Remove
        </button>
      </div>

      {(status || saving || busy) && (
        <p className="busy-bar" aria-live="polite">
          {busy || saving ? status || "Working…" : status}
        </p>
      )}

      <div className="collage-actions">
        {onCancel && (
          <button
            type="button"
            className="btn-secondary"
            disabled={saving || busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={saving || busy || items.length === 0}
          onClick={() => void save()}
        >
          Save collage
        </button>
      </div>
    </div>
  );
}
