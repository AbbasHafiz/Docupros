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

export function CropEditor({ imageSrc, quad, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, scale: 1 });
  const dragRef = useRef<CornerKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadImage(imageSrc).then((img) => {
      if (cancelled) return;
      const maxW = Math.min(window.innerWidth - 32, 720);
      const maxH = Math.min(window.innerHeight * 0.55, 640);
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
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

      // Dim outside
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

      // Border
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.strokeStyle = "#2dd4bf";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Handles
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

  const hitTest = (x: number, y: number): CornerKey | null => {
    const threshold = 22;
    for (const key of ORDER) {
      const px = quad[key].x * size.scale;
      const py = quad[key].y * size.scale;
      if (Math.hypot(px - x, py - y) <= threshold) return key;
    }
    return null;
  };

  const toLocal = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const { x, y } = toLocal(e);
    const key = hitTest(x, y);
    if (!key) return;
    dragRef.current = key;
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !size.scale) return;
    const { x, y } = toLocal(e);
    const next: Point = {
      x: Math.max(0, Math.min(size.w / size.scale, x / size.scale)),
      y: Math.max(0, Math.min(size.h / size.scale, y / size.scale)),
    };
    onChange({ ...quad, [dragRef.current]: next });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="crop-wrap">
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="crop-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <p className="hint">Drag the corners to match the document edges.</p>
    </div>
  );
}
