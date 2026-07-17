# Docupros

CamScanner-style document scanner in the browser.

## Features

- **Camera capture** or gallery upload
- **Corner crop** with perspective correction
- **Enhance filters** — Magic, Color, Gray, B&W, Soft
- **Page editor**
  - **Enhance** — brightness, contrast, sharpen, rotate, reset
  - **Erase** — brush out stains, marks, or writing (paper-color fill)
  - **Text** — OCR detect words, tap to replace/erase on the image, find & replace, add text, edit extracted text
- **Multi-page documents** stored locally (IndexedDB)
- **PDF export**
- **OCR** text extraction (Tesseract.js)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Camera access needs HTTPS (or `localhost`). On a phone, use your machine’s LAN URL over HTTPS or deploy the app.

## Workflow

1. **New scan** → capture/upload → crop → enhance → save
2. Open a document → **Edit page**
3. Use **Enhance**, **Erase**, or **Text** tools, then **Done**
4. **Export PDF** or copy/edit extracted text

## Stack

Next.js · React · TypeScript · Tailwind CSS · jsPDF · Tesseract.js · IndexedDB
