"use client";

import { useEffect, useRef, useState } from "react";
import type { Point, Quad } from "@/lib/types";
import { loadImage } from "@/lib/imageProcessing";

type CornerKey = keyof Quad;

type Props = {
  imageSrc: string;
  quad: Quad;
  onChange: (quad: Quad) => void;
};

const ORDER: CornerKey[] = ["tl", "tr", "br", "bl"];

function pinchDistance(a: React.Touch, b: React.Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function CropEditor({ imageSrc, quad, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, scale: 1 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<CornerKey | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setZoom(1);
    void loadImage(imageSrc).then((img) => {
      if (cancelled) return;
      const maxW = Math.min(window.innerWidth - 32, 720);
      const maxH = Math.min(window.innerHeight * 0.5, 560);
      const scale = Math.min(
        maxW / img.naturalWidth,
        maxH / img.naturalHeight,
        1,
      );
      setSize({
        w: Math.round(img.naturalWidth * scale),
        h: Math.round(img.naturalHeight * scale),
        scale,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    void loadImage(imageSrc).then((img) => {
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.drawImage(img, 0, 0, size.w, size.h);

      const pts = ORDER.map((k) => ({
        x: quad[k].x * size.scale,
        y: quad[k].y * size.scale,
      }));

      ctx.save();
      ctx.fillStyle = "rgba(8, 16, 28, 0.55)";
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.strokeStyle = "#2dd4bf";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = "#f4fbf9";
        ctx.fill();
        ctx.strokeStyle = "#0f766e";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [imageSrc, quad, size]);

  const clampZoom = (z: number) => Math.min(4, Math.max(1, z));

  const toLocal = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * size.w;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * size.h;
    return { x, y };
  };

  const hitTest = (x: number, y: number): CornerKey | null => {
    const threshold = 22 / Math.max(1, Math.sqrt(zoom));
    for (const key of ORDER) {
      const px = quad[key].x * size.scale;
      const py = quad[key].y * size.scale;
      if (Math.hypot(px - x, py - y) <= threshold) return key;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && (e as unknown as { isPrimary?: boolean })) {
      // Pinch handled via touch events on viewport
    }
    const { x, y } = toLocal(e.clientX, e.clientY);
    const key = hitTest(x, y);
    if (!key) return;
    dragRef.current = key;
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !size.scale) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    const next: Point = {
      x: Math.max(0, Math.min(size.w / size.scale, x / size.scale)),
      y: Math.max(0, Math.min(size.h / size.scale, y / size.scale)),
    };
    onChange({ ...quad, [dragRef.current]: next });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      dragRef.current = null;
      const dist = pinchDistance(e.touches[0], e.touches[1]);
      pinchRef.current = { startDist: dist, startZoom: zoom };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = pinchDistance(e.touches[0], e.touches[1]);
      const ratio = dist / Math.max(1, pinchRef.current.startDist);
      setZoom(clampZoom(pinchRef.current.startZoom * ratio));
    }
  };

  const onTouchEnd = () => {
    if (!pinchRef.current) return;
    // Keep pinch active until both fingers lift
    pinchRef.current = null;
  };

  const displayW = Math.max(1, Math.round(size.w * zoom));
  const displayH = Math.max(1, Math.round(size.h * zoom));

  return (
    <div className="crop-wrap">
      <div className="crop-zoom-bar" role="toolbar" aria-label="Crop zoom">
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
          disabled={zoom >= 4}
          onClick={() => setZoom((z) => clampZoom(z + 0.25))}
          aria-label="Zoom in"
        >
          +
        </button>
        {zoom <= 1.05 && (
          <span className="cs-zoom-hint">Pinch to zoom · drag corners</span>
        )}
        {zoom > 1.05 && (
          <span className="cs-zoom-hint">Scroll to pan · drag corners</span>
        )}
      </div>
      <div
        className={`crop-viewport ${zoom > 1 ? "is-zoomed" : ""}`}
        ref={viewportRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="crop-zoom-inner"
          style={{ width: displayW, height: displayH }}
        >
          <canvas
            ref={canvasRef}
            width={size.w}
            height={size.h}
            className="crop-canvas"
            style={{ width: displayW, height: displayH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </div>
      <p className="hint crop-hint">
        Pinch to zoom. Drag corners to crop, or choose Full size import.
      </p>
    </div>
  );
}
