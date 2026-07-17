"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
};

export function SignaturePad({ open, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setEmpty(true);
  }, [open]);

  if (!open) return null;

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Sign">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2>Sign</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="hint">Draw your signature below.</p>
        <canvas
          ref={canvasRef}
          width={640}
          height={220}
          className="sign-canvas"
          onPointerDown={(e) => {
            drawing.current = true;
            const ctx = canvasRef.current?.getContext("2d");
            if (!ctx) return;
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            canvasRef.current?.setPointerCapture(e.pointerId);
            setEmpty(false);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvasRef.current?.getContext("2d");
            if (!ctx) return;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
        />
        <div className="row-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext("2d");
              if (!canvas || !ctx) return;
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              setEmpty(true);
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={empty}
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              onSave(canvas.toDataURL("image/png"));
            }}
          >
            Use signature
          </button>
        </div>
      </div>
    </div>
  );
}
