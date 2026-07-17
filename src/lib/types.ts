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

export type DocumentKind = "document" | "id_card" | "pdf_form";

export type ScanPage = {
  id: string;
  imageDataUrl: string;
  originalDataUrl?: string;
  filter: ScanFilter;
  createdAt: number;
  ocrText?: string;
  ocrWords?: OcrWord[];
  side?: "front" | "back";
};

export type FormFieldType = "text" | "multiline" | "checkbox" | "date" | "signature";

/** Normalized 0–1 coordinates relative to page image size. */
export type FormField = {
  id: string;
  pageId: string;
  type: FormFieldType;
  name: string;
  label: string;
  value: string;
  /** Fraction of page width/height (0–1) */
  x: number;
  y: number;
  w: number;
  h: number;
  required?: boolean;
  checked?: boolean;
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
  /** Fillable form fields overlaid on pages */
  formFields?: FormField[];
  /** Original imported PDF bytes as base64 (optional, for AcroForm round-trip) */
  sourcePdfBase64?: string;
};

export type ScanStep = "capture" | "crop" | "enhance" | "review";
export type ScanMode = "document" | "id_card";

/** Bottom category tabs matching CamScanner-style editor. */
export type EditorTab = "images" | "markup" | "page";

/** Tools under Images tab. */
export type ImageTool =
  | "crop"
  | "filter"
  | "editText"
  | "smartErase"
  | "retake"
  | "sign"
  | "addText";

export type MarkupTool = "pen" | "highlight";

export type EnhanceAdjustments = {
  brightness: number;
  contrast: number;
  sharpness: number;
};
