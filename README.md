# Docupros

CamScanner-style document & ID scanner in the browser.

## Features

- **Document scan** — camera/gallery, crop, multi-page
- **ID card mode** — front + back → A4 ID print sheet (Print / Print ×2)
- **Enhance filters** — Magic, Color, Vivid, Gray, B&W, Board, Deepen, Lighten, Soft
- **Page editor**
  - Enhance (filters, brightness/contrast/sharpen, rotate, reset)
  - Erase marks
  - Text OCR replace / find-replace / add text
  - Annotate / mark
- **Print** documents or ID layout
- **PDF export** (A4 fit) + watermark
- **Page manage** — reorder / delete
- **OCR** (Tesseract.js) · local IndexedDB storage

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## ID Print

1. Home → **ID Card**
2. Scan front → enhance → scan back
3. Open document → **ID Print** (or Print ×2 / Export PDF)
