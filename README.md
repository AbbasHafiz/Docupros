# Docupros

CamScanner-style document scanner in the browser.

## Features

- **Camera capture** or gallery upload
- **Corner crop** with perspective correction
- **Enhance filters** — Magic, Color, Gray, B&W, Soft
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

## Stack

Next.js · React · TypeScript · Tailwind CSS · jsPDF · Tesseract.js · IndexedDB
