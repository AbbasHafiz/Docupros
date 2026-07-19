"use client";

import type { WatermarkOptions } from "@/lib/types";
import { watermarkTileGrid } from "@/lib/watermark";

type Props = {
  options: WatermarkOptions;
};

/** Live watermark preview over a page image (does not alter pixels). */
export function WatermarkOverlay({ options }: Props) {
  const tiled = options.layout === "full";
  const grid = tiled ? watermarkTileGrid(options.spacing) : { cols: 1, rows: 1 };
  const marks = tiled
    ? Array.from({ length: grid.cols * grid.rows }, (_, i) => i)
    : [0];
  const sizeScale = options.size || 1;

  return (
    <div
      className={`page-watermark-overlay ${tiled ? "is-full" : "is-center"}`}
      aria-hidden
      style={{
        ["--wm-color" as string]: options.color,
        ["--wm-opacity" as string]: String(Math.max(options.opacity, 0.12)),
        ["--wm-angle" as string]: `${options.angle}deg`,
        ["--wm-size" as string]: String(sizeScale),
        ["--wm-cols" as string]: String(grid.cols),
        ["--wm-rows" as string]: String(grid.rows),
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
