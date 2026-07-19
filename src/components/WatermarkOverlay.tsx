"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import type { WatermarkOptions } from "@/lib/types";
import { watermarkTileGrid } from "@/lib/watermark";

type Props = {
  options: WatermarkOptions;
  /** Page image — overlay is sized to the painted page, not letterbox bars. */
  imageRef: RefObject<HTMLImageElement | null>;
};

type Box = { left: number; top: number; width: number; height: number };

/** Content box of an object-fit:contain (or shrink-wrapped) image. */
function pageContentBox(img: HTMLImageElement): Box {
  const cw = img.clientWidth;
  const ch = img.clientHeight;
  const nw = img.naturalWidth || cw;
  const nh = img.naturalHeight || ch;
  if (!cw || !ch) return { left: 0, top: 0, width: 0, height: 0 };

  // Shrink-wrapped images already match content; contain may letterbox.
  const fit = getComputedStyle(img).objectFit;
  if (fit === "contain" && nw > 0 && nh > 0) {
    const scale = Math.min(cw / nw, ch / nh);
    const width = nw * scale;
    const height = nh * scale;
    return {
      left: (cw - width) / 2,
      top: (ch - height) / 2,
      width,
      height,
    };
  }

  return { left: 0, top: 0, width: cw, height: ch };
}

/** Live watermark preview clipped exactly to the page image. */
export function WatermarkOverlay({ options, imageRef }: Props) {
  const tiled = options.layout === "full";
  const grid = tiled ? watermarkTileGrid(options.spacing) : { cols: 1, rows: 1 };
  const marks = tiled
    ? Array.from({ length: grid.cols * grid.rows }, (_, i) => i)
    : [0];
  const sizeScale = options.size || 1;
  const [box, setBox] = useState<Box>({ left: 0, top: 0, width: 0, height: 0 });

  useLayoutEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const update = () => setBox(pageContentBox(img));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(img);
    img.addEventListener("load", update);
    return () => {
      ro.disconnect();
      img.removeEventListener("load", update);
    };
  }, [imageRef, options.layout, options.spacing, options.size]);

  if (box.width < 2 || box.height < 2) return null;

  // Scale type to page width so long marks stay on the page
  const basePx = Math.max(10, Math.min(box.width, box.height) / (tiled ? 14 : 9));
  const fontPx = basePx * sizeScale;

  return (
    <div
      className={`page-watermark-overlay ${tiled ? "is-full" : "is-center"}`}
      aria-hidden
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        ["--wm-color" as string]: options.color,
        ["--wm-opacity" as string]: String(Math.max(options.opacity, 0.12)),
        ["--wm-angle" as string]: `${options.angle}deg`,
        ["--wm-size" as string]: String(sizeScale),
        ["--wm-cols" as string]: String(grid.cols),
        ["--wm-rows" as string]: String(grid.rows),
        ["--wm-font" as string]: `${fontPx}px`,
      }}
    >
      {marks.map((i) => (
        <span
          key={i}
          className={`page-watermark-mark ${tiled ? "is-tiled" : "is-center"}`}
        >
          {options.text}
        </span>
      ))}
    </div>
  );
}
