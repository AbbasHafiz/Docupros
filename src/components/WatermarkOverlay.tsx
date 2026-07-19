"use client";

import type { WatermarkOptions } from "@/lib/types";
import { watermarkTileGrid } from "@/lib/watermark";

type Props = {
  options: WatermarkOptions;
};

/**
 * Instant CSS watermark on the page frame.
 * Uses rem sizing (not container queries) so it never collapses to 0px.
 */
export function WatermarkOverlay({ options }: Props) {
  const tiled = options.layout === "full";
  const grid = tiled ? watermarkTileGrid(options.spacing) : { cols: 1, rows: 1 };
  const count = tiled ? grid.cols * grid.rows : 1;
  const sizeScale = options.size || 1;

  return (
    <div
      className={`page-watermark-overlay is-css ${tiled ? "is-full" : "is-center"}`}
      aria-hidden
      style={{
        ["--wm-color" as string]: options.color || "#0f766e",
        ["--wm-opacity" as string]: String(
          Math.max(0.34, Math.min(0.7, options.opacity || 0.34)),
        ),
        ["--wm-angle" as string]: `${options.angle ?? 35}deg`,
        ["--wm-size" as string]: String(sizeScale),
        ["--wm-cols" as string]: String(grid.cols),
        ["--wm-rows" as string]: String(grid.rows),
      }}
    >
      {Array.from({ length: count }, (_, i) => (
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
