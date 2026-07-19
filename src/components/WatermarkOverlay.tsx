"use client";

import type { WatermarkOptions } from "@/lib/types";

type Props = {
  options: WatermarkOptions;
};

/** Live watermark preview over a page image (does not alter pixels). */
export function WatermarkOverlay({ options }: Props) {
  const tiled = options.layout === "full";
  const marks = tiled ? Array.from({ length: 12 }, (_, i) => i) : [0];

  return (
    <div
      className={`page-watermark-overlay ${tiled ? "is-full" : "is-center"}`}
      aria-hidden
      style={{
        ["--wm-color" as string]: options.color,
        ["--wm-opacity" as string]: String(Math.max(options.opacity, 0.12)),
        ["--wm-angle" as string]: `${options.angle}deg`,
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
