export type ScanFilter = "original" | "magic" | "grayscale" | "bw" | "soft";

export type Point = { x: number; y: number };

export type Quad = {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
};

export type BBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type OcrWord = {
  id: string;
  text: string;
  confidence: number;
  bbox: BBox;
};

export type OcrResult = {
  text: string;
  words: OcrWord[];
};

export type ScanPage = {
  id: string;
  imageDataUrl: string;
  /** Original scan before edits (for reset). */
  originalDataUrl?: string;
  filter: ScanFilter;
  createdAt: number;
  ocrText?: string;
  ocrWords?: OcrWord[];
};

export type DocumentRecord = {
  id: string;
  title: string;
  pages: ScanPage[];
  createdAt: number;
  updatedAt: number;
  ocrText?: string;
  thumbnail?: string;
};

export type ScanStep = "capture" | "crop" | "enhance" | "review";

export type EditorTool = "view" | "erase" | "enhance" | "text";

export type EnhanceAdjustments = {
  brightness: number;
  contrast: number;
  sharpness: number;
};
