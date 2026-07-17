export type ScanFilter =
  | "original"
  | "magic"
  | "grayscale"
  | "bw"
  | "soft"
  | "vivid"
  | "whiteboard"
  | "deepen"
  | "lighten";

export const SCAN_FILTERS: { id: ScanFilter; label: string }[] = [
  { id: "magic", label: "Magic" },
  { id: "original", label: "Color" },
  { id: "vivid", label: "Vivid" },
  { id: "grayscale", label: "Gray" },
  { id: "bw", label: "B&W" },
  { id: "whiteboard", label: "Board" },
  { id: "deepen", label: "Deepen" },
  { id: "lighten", label: "Lighten" },
  { id: "soft", label: "Soft" },
];

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

export type DocumentKind = "document" | "id_card";

export type ScanPage = {
  id: string;
  imageDataUrl: string;
  /** Original scan before edits (for reset). */
  originalDataUrl?: string;
  filter: ScanFilter;
  createdAt: number;
  ocrText?: string;
  ocrWords?: OcrWord[];
  /** For ID cards: front or back. */
  side?: "front" | "back";
};

export type DocumentRecord = {
  id: string;
  title: string;
  pages: ScanPage[];
  createdAt: number;
  updatedAt: number;
  ocrText?: string;
  thumbnail?: string;
  kind?: DocumentKind;
  watermark?: string;
};

export type ScanStep = "capture" | "crop" | "enhance" | "review";

export type ScanMode = "document" | "id_card";

export type EditorTool = "view" | "erase" | "enhance" | "text" | "annotate";

export type EnhanceAdjustments = {
  brightness: number;
  contrast: number;
  sharpness: number;
};
