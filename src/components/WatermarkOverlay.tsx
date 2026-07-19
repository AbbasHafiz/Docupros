"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { WatermarkOptions } from "@/lib/types";
import { applyWatermarkToCanvas } from "@/lib/watermark";

type Props = {
  options: WatermarkOptions;
  /** Page image — overlay matches its displayed box. */
  imageRef: RefObject<HTMLImageElement | null>;
  /** Remeasure when page src changes. */
  imageSrc?: string;
};

/**
 * Canvas watermark over the page — same drawing as PDF export,
 * clipped to the page frame so it always shows in-app.
 */
export function WatermarkOverlay({ options, imageRef, imageSrc }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    let cancelled = false;

    const paint = () => {
      if (cancelled) return;
      const w = img.clientWidth;
      const h = img.clientHeight;
      if (w < 2 || h < 2) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      applyWatermarkToCanvas(ctx, w, h, options);
    };

    paint();
    // Retry after layout / decode (data-URLs can report 0×0 for a frame)
    const raf = window.requestAnimationFrame(paint);
    const t1 = window.setTimeout(paint, 50);
    const t2 = window.setTimeout(paint, 200);

    const ro = new ResizeObserver(paint);
    ro.observe(img);
    if (img.parentElement) ro.observe(img.parentElement);
    img.addEventListener("load", paint);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro.disconnect();
      img.removeEventListener("load", paint);
    };
  }, [
    imageRef,
    imageSrc,
    options.text,
    options.color,
    options.opacity,
    options.layout,
    options.angle,
    options.size,
    options.spacing,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="page-watermark-overlay"
      aria-hidden
    />
  );
}
