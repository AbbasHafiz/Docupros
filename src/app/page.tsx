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
          <span className="mode-title">ID Card</span>
          <span className="mode-desc">Front + back → A4 ID print</span>
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
