export async function extractTextFromImages(
  imageDataUrls: string[],
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });

  try {
    const parts: string[] = [];
    for (let i = 0; i < imageDataUrls.length; i++) {
      const { data } = await worker.recognize(imageDataUrls[i]);
      const text = data.text.trim();
      if (text) {
        parts.push(
          imageDataUrls.length > 1 ? `— Page ${i + 1} —\n${text}` : text,
        );
      }
      onProgress?.(Math.round(((i + 1) / imageDataUrls.length) * 100));
    }
    return parts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
