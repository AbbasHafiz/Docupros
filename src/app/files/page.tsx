import { DocumentLibrary } from "@/components/DocumentLibrary";
import Link from "next/link";

export default function FilesPage() {
  return (
    <main className="home files-page">
      <section className="hero" style={{ paddingBottom: "1rem" }}>
        <h1 className="hero-brand" style={{ fontSize: "2.2rem" }}>
          Files
        </h1>
        <p className="hero-copy">Your scanned documents and forms.</p>
      </section>
      <DocumentLibrary />
      <Link href="/scan" className="fab">
        <span aria-hidden>+</span>
        New scan
      </Link>
    </main>
  );
}
