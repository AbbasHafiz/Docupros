export type ScanFilter = "original" | "magic" | "grayscale" | "bw" | "soft";

export type Point = { x: number; y: number };

export type Quad = {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
};

export type ScanPage = {
  id: string;
  imageDataUrl: string;
  filter: ScanFilter;
  createdAt: number;
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
