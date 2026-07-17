export type ScanFilter =
  | "original"
  | "magic"
  | "grayscale"
  | "bw"
  | "soft"
  | "vivid"
  | "whiteboard"
  | "deepen"
  | "lighten"
  | "restore";

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
  { id: "restore", label: "Restore" },
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

export type FormField = {
  id: string;
  pageId: string;
  type: FormFieldType;
  name: string;
  label: string;
  value: string;
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
  formFields?: FormField[];
  sourcePdfBase64?: string;
  /** App-level lock password (SHA-256 hex). */
  lockHash?: string;
  locked?: boolean;
};

export type ScanStep = "capture" | "crop" | "enhance" | "review";
export type ScanMode =
  | "document"
  | "id_card"
  | "book"
  | "slides"
  | "whiteboard"
  | "timestamp";

export type EditorTab = "images" | "markup" | "page";

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

export type ToolItem = {
  id: string;
  label: string;
  href: string;
  color: string;
  icon: string;
  status: "ready" | "partial" | "soon";
};
