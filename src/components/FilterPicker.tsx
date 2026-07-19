"use client";

import { useRef, useState } from "react";
import type { ScanFilter } from "@/lib/types";
import { SCAN_FILTERS } from "@/lib/types";

type Props = {
  value: ScanFilter;
  previewSrc: string;
  previews: Partial<Record<ScanFilter, string>>;
  onChange: (filter: ScanFilter) => void;
};

function pinchDistance(a: React.Touch, b: React.Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function FilterPicker({ value, previewSrc, previews, onChange }: Props) {
  const [zoom, setZoom] = useState(1);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(
    null,
  );
  const clampZoom = (z: number) => Math.min(3.5, Math.max(1, z));

  return (
    <div className="filter-panel">
      <div className="crop-zoom-bar" role="toolbar" aria-label="Preview zoom">
        <button
          type="button"
          className="cs-zoom-btn"
          disabled={zoom <= 1}
          onClick={() => setZoom((z) => clampZoom(z - 0.25))}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="cs-zoom-pct"
          onClick={() => setZoom(1)}
          aria-label="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="cs-zoom-btn"
          disabled={zoom >= 3.5}
          onClick={() => setZoom((z) => clampZoom(z + 0.25))}
          aria-label="Zoom in"
        >
          +
        </button>
        {zoom <= 1.05 && (
          <span className="cs-zoom-hint">Pinch to inspect</span>
        )}
      </div>
      <div
        className={`filter-preview ${zoom > 1 ? "is-zoomed" : ""}`}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            pinchRef.current = {
              startDist: pinchDistance(e.touches[0], e.touches[1]),
              startZoom: zoom,
            };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchRef.current) {
            e.preventDefault();
            const dist = pinchDistance(e.touches[0], e.touches[1]);
            const ratio = dist / Math.max(1, pinchRef.current.startDist);
            setZoom(clampZoom(pinchRef.current.startZoom * ratio));
          }
        }}
        onTouchEnd={() => {
          pinchRef.current = null;
        }}
        onTouchCancel={() => {
          pinchRef.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previews[value] ?? previewSrc}
          alt="Enhanced preview"
          style={
            zoom > 1
              ? {
                  width: `${zoom * 100}%`,
                  maxWidth: "none",
                  height: "auto",
                }
              : undefined
          }
        />
      </div>
      <div className="filter-row" role="listbox" aria-label="Scan filters">
        {SCAN_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="option"
            aria-selected={value === f.id}
            className={`filter-chip ${value === f.id ? "is-active" : ""}`}
            onClick={() => onChange(f.id)}
          >
            <span className="filter-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[f.id] ?? previewSrc} alt="" />
            </span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
