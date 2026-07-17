"use client";

import type { ScanFilter } from "@/lib/types";

const FILTERS: { id: ScanFilter; label: string }[] = [
  { id: "magic", label: "Magic" },
  { id: "original", label: "Color" },
  { id: "grayscale", label: "Gray" },
  { id: "bw", label: "B&W" },
  { id: "soft", label: "Soft" },
];

type Props = {
  value: ScanFilter;
  previewSrc: string;
  previews: Partial<Record<ScanFilter, string>>;
  onChange: (filter: ScanFilter) => void;
};

export function FilterPicker({ value, previewSrc, previews, onChange }: Props) {
  return (
    <div className="filter-panel">
      <div className="filter-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previews[value] ?? previewSrc} alt="Enhanced preview" />
      </div>
      <div className="filter-row" role="listbox" aria-label="Scan filters">
        {FILTERS.map((f) => (
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
