import Link from "next/link";

export default function MePage() {
  return (
    <main className="home">
      <section className="hero">
        <h1 className="hero-brand" style={{ fontSize: "2.2rem" }}>
          Me
        </h1>
        <p className="hero-copy">
          Docupros stores scans on this device. No account required.
        </p>
      </section>
      <div className="text-edit-box">
        <p className="subhead">About</p>
        <p className="hint">
          Local-first CamScanner-style scanner: capture, enhance, edit, form
          fill, convert, print, and lock documents in your browser.
        </p>
        <div className="row-actions" style={{ marginTop: "0.75rem" }}>
          <Link href="/tools" className="btn-secondary">
            Open Tools
          </Link>
          <Link href="/import" className="btn-secondary">
            Import PDF
          </Link>
        </div>
      </div>
    </main>
  );
}
