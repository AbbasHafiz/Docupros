import { createId } from "./id";
import type { OcrResult, OcrWord } from "./types";

export async function extractTextFromImages(
  imageDataUrls: string[],
  onProgress?: (pct: number) => void,
): Promise<string> {
  const results = await Promise.all(
    imageDataUrls.map((src, i) =>
      recognizePage(src, (pct) => {
        const base = (i / imageDataUrls.length) * 100;
        const slice = pct / imageDataUrls.length;
        onProgress?.(Math.round(base + slice));
      }),
    ),
  );
  onProgress?.(100);
  return results
    .map((r, i) => {
      const text = r.text.trim();
      if (!text) return "";
      return imageDataUrls.length > 1 ? `— Page ${i + 1} —\n${text}` : text;
    })
    .filter(Boolean)
    .join("\n\n");
}

export async function recognizePage(
  imageDataUrl: string,
  onProgress?: (pct: number) => void,
): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });

  try {
    const { data } = await worker.recognize(
      imageDataUrl,
      {},
      { text: true, blocks: true },
    );

    const words: OcrWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          for (const w of line.words ?? []) {
            if (!w.text?.trim() || (w.confidence ?? 0) <= 20) continue;
            words.push({
              id: createId(),
              text: w.text.trim(),
              confidence: w.confidence ?? 0,
              bbox: {
                x0: w.bbox.x0,
                y0: w.bbox.y0,
                x1: w.bbox.x1,
                y1: w.bbox.y1,
              },
            });
          }
        }
      }
    }

    return {
      text: (data.text ?? "").trim(),
      words,
    };
  } finally {
    await worker.terminate();
  }
}
