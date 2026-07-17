import Link from "next/link";
import { DocumentLibrary } from "@/components/DocumentLibrary";

export default function HomePage() {
  return (
    <main className="home">
      <section className="hero">
        <h1 className="hero-brand">Docupros</h1>
        <p className="hero-copy">
          Scan docs and ID cards, enhance like CamScanner, edit text, erase
          marks, and print.
        </p>
      </section>

      <div className="mode-row">
        <Link href="/scan" className="mode-card">
          <span className="mode-title">Document</span>
          <span className="mode-desc">Multi-page scan, enhance, OCR, PDF</span>
        </Link>
        <Link href="/scan?mode=id_card" className="mode-card accent">
          <span className="mode-title">CNIC</span>
          <span className="mode-desc">Pakistani ID · 85.6×54 mm · front + back</span>
        </Link>
      </div>
      <div className="mode-row">
        <Link href="/import" className="mode-card">
          <span className="mode-title">Import PDF</span>
          <span className="mode-desc">Open PDF pages, fill forms, export</span>
        </Link>
        <Link href="/scan" className="mode-card">
          <span className="mode-title">Scan → Form</span>
          <span className="mode-desc">Scan then place fillable fields</span>
        </Link>
      </div>

      <DocumentLibrary />

      <Link href="/scan" className="fab">
        <span aria-hidden>+</span>
        New scan
      </Link>
    </main>
  );
}
