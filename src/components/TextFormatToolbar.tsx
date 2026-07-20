"use client";

import { useEffect, useRef, useState } from "react";
import { DOC_TEXT_FONT } from "@/lib/editOperations";

export const TEXT_FONT_OPTIONS = [
  {
    id: "doc",
    label: "Document",
    family: DOC_TEXT_FONT,
  },
  {
    id: "arial",
    label: "Arial",
    family: "Arial, Helvetica, sans-serif",
  },
  {
    id: "georgia",
    label: "Georgia",
    family: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "courier",
    label: "Courier",
    family: '"Courier New", Courier, monospace',
  },
  {
    id: "verdana",
    label: "Verdana",
    family: "Verdana, Geneva, sans-serif",
  },
] as const;

export const TEXT_COLOR_OPTIONS = [
  "#111111",
  "#1f2937",
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#ffffff",
];

export type TextFormatValue = {
  bold: boolean;
  italic: boolean;
  fontFamily: string;
  fontSize: number;
  color: string;
  link: string;
};

type Panel = "size" | "font" | "color" | "link" | null;

type Props = {
  value: TextFormatValue;
  onChange: (next: Partial<TextFormatValue>) => void;
  onMovePointerDown?: (e: React.PointerEvent) => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  onClose?: () => void;
  showMove?: boolean;
  showDuplicate?: boolean;
  className?: string;
};

export function TextFormatToolbar({
  value,
  onChange,
  onMovePointerDown,
  onDuplicate,
  onDelete,
  onClose,
  showMove = true,
  showDuplicate = true,
  className = "",
}: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panel) return;
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPanel(null);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [panel]);

  const togglePanel = (p: Panel) =>
    setPanel((cur) => (cur === p ? null : p));

  return (
    <div
      ref={rootRef}
      className={`text-format-toolbar ${className}`.trim()}
      role="toolbar"
      aria-label="Text formatting"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`tft-btn ${value.bold ? "is-active" : ""}`}
        aria-label="Bold"
        aria-pressed={value.bold}
        onClick={() => onChange({ bold: !value.bold })}
      >
        <span className="tft-b">B</span>
      </button>
      <button
        type="button"
        className={`tft-btn ${value.italic ? "is-active" : ""}`}
        aria-label="Italic"
        aria-pressed={value.italic}
        onClick={() => onChange({ italic: !value.italic })}
      >
        <span className="tft-i">I</span>
      </button>

      <button
        type="button"
        className={`tft-btn has-caret ${panel === "size" ? "is-open" : ""}`}
        aria-label="Font size"
        aria-expanded={panel === "size"}
        onClick={() => togglePanel("size")}
      >
        <span className="tft-size-icon" aria-hidden>
          T
          <span className="tft-size-arrows">↕</span>
        </span>
        <span className="tft-caret" aria-hidden>
          ▾
        </span>
      </button>

      <button
        type="button"
        className={`tft-btn has-caret ${panel === "font" ? "is-open" : ""}`}
        aria-label="Font"
        aria-expanded={panel === "font"}
        onClick={() => togglePanel("font")}
      >
        <span className="tft-aa">Aa</span>
        <span className="tft-caret" aria-hidden>
          ▾
        </span>
      </button>

      <button
        type="button"
        className={`tft-btn has-caret ${panel === "color" ? "is-open" : ""}`}
        aria-label="Color"
        aria-expanded={panel === "color"}
        onClick={() => togglePanel("color")}
      >
        <span className="tft-palette" aria-hidden>
          <span
            className="tft-palette-dot"
            style={{ background: value.color }}
          />
        </span>
        <span className="tft-caret" aria-hidden>
          ▾
        </span>
      </button>

      <button
        type="button"
        className={`tft-btn ${panel === "link" || value.link ? "is-active" : ""}`}
        aria-label="Link"
        aria-expanded={panel === "link"}
        onClick={() => togglePanel("link")}
      >
        <span className="tft-link" aria-hidden>
          🔗
        </span>
      </button>

      {showMove && (
        <button
          type="button"
          className="tft-btn tft-move"
          aria-label="Move text"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMovePointerDown?.(e);
          }}
        >
          <span className="tft-move-icon" aria-hidden>
            ✥
          </span>
        </button>
      )}

      {showDuplicate && onDuplicate && (
        <button
          type="button"
          className="tft-btn"
          aria-label="Duplicate text"
          onClick={onDuplicate}
        >
          <span className="tft-dup" aria-hidden>
            ▯▯
          </span>
        </button>
      )}

      <button
        type="button"
        className="tft-btn tft-danger"
        aria-label="Delete text"
        onClick={onDelete}
      >
        <span className="tft-trash" aria-hidden>
          🗑
        </span>
      </button>

      {onClose && (
        <button
          type="button"
          className="tft-btn tft-done"
          aria-label="Done formatting — drag to place"
          onClick={onClose}
        >
          Done
        </button>
      )}

      {panel === "size" && (
        <div className="tft-panel" role="dialog" aria-label="Font size">
          <div className="tft-panel-row">
            <button
              type="button"
              className="tft-panel-btn"
              onClick={() =>
                onChange({
                  fontSize: Math.max(8, value.fontSize - 2),
                })
              }
            >
              A−
            </button>
            <span className="tft-panel-value">{value.fontSize}px</span>
            <button
              type="button"
              className="tft-panel-btn"
              onClick={() =>
                onChange({
                  fontSize: Math.min(120, value.fontSize + 2),
                })
              }
            >
              A+
            </button>
          </div>
          <input
            type="range"
            min={8}
            max={96}
            value={value.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          />
        </div>
      )}

      {panel === "font" && (
        <div className="tft-panel tft-font-panel" role="listbox" aria-label="Font">
          {TEXT_FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={value.fontFamily === f.family}
              className={`tft-font-opt ${
                value.fontFamily === f.family ? "is-active" : ""
              }`}
              style={{ fontFamily: f.family }}
              onClick={() => {
                onChange({ fontFamily: f.family });
                setPanel(null);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {panel === "color" && (
        <div className="tft-panel tft-color-panel" role="listbox" aria-label="Color">
          {TEXT_COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={value.color === c}
              className={`tft-swatch ${value.color === c ? "is-active" : ""}`}
              style={{ background: c }}
              onClick={() => {
                onChange({ color: c });
                setPanel(null);
              }}
            />
          ))}
          <label className="tft-custom-color" title="Custom color">
            <input
              type="color"
              value={value.color}
              onChange={(e) => onChange({ color: e.target.value })}
            />
          </label>
        </div>
      )}

      {panel === "link" && (
        <div className="tft-panel tft-link-panel" role="dialog" aria-label="Link">
          <input
            type="url"
            placeholder="https://"
            value={value.link}
            onChange={(e) => onChange({ link: e.target.value })}
            autoFocus
          />
          <button
            type="button"
            className="tft-panel-btn"
            onClick={() => setPanel(null)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
