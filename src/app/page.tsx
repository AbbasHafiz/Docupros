import Link from "next/link";
import { DocumentLibrary } from "@/components/DocumentLibrary";

export default function HomePage() {
  return (
    <main className="home">
      <section className="hero">
        <h1 className="hero-brand">Docupros</h1>
        <p className="hero-copy">
          Turn phone photos into clean multi-page scans — crop, enhance, OCR,
          and export PDF.
        </p>
      </section>

      <DocumentLibrary />

      <Link href="/scan" className="fab">
        <span aria-hidden>+</span>
        New scan
      </Link>
    </main>
  );
}
