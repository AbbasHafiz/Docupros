import Link from "next/link";
import { DocumentLibrary } from "@/components/DocumentLibrary";

export default function HomePage() {
  return (
    <main className="home android-home">
      <section className="hero app-hero">
        <p className="hero-kicker">Scanner</p>
        <h1 className="hero-brand">Docupros</h1>
        <p className="hero-copy">
          Capture, enhance, watermark, and export — built for phone-first
          scanning.
        </p>
      </section>

      <div className="quick-actions" aria-label="Quick actions">
        <Link href="/scan" className="quick-action">
          <span className="quick-action-icon" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9v1.8H5.8V9H4V5.5Zm10 0V4h3.5A1.5 1.5 0 0 1 19 5.5V9h-1.8V5.8H14V5.5ZM4 15h1.8v3.2H9V20H5.5A1.5 1.5 0 0 1 4 18.5V15Zm13.2 3.2V15H19v3.5a1.5 1.5 0 0 1-1.5 1.5H14v-1.8h3.2ZM7.5 8.5h9v7h-9v-7Z"
              />
            </svg>
          </span>
          <span className="quick-action-label">Scan</span>
        </Link>
        <Link href="/scan?mode=id_card" className="quick-action">
          <span className="quick-action-icon is-accent" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M3.5 7A2.5 2.5 0 0 1 6 4.5h12A2.5 2.5 0 0 1 20.5 7v10a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17V7Zm3 2.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6Zm6.2.8h5.3v1.5h-5.3V10Zm0 3.2h4.2V15h-4.2v-1.8Z"
              />
            </svg>
          </span>
          <span className="quick-action-label">CNIC</span>
        </Link>
        <Link href="/import" className="quick-action">
          <span className="quick-action-icon" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12 3.5a1 1 0 0 1 1 1v8.2l2.4-2.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L7.2 11.7a1 1 0 1 1 1.4-1.4l2.4 2.4V4.5a1 1 0 0 1 1-1ZM5 17.5A1.5 1.5 0 0 1 6.5 16h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 5 17.5Z"
              />
            </svg>
          </span>
          <span className="quick-action-label">Import</span>
        </Link>
        <Link href="/tools" className="quick-action">
          <span className="quick-action-icon" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M4.5 5.5A1.5 1.5 0 0 1 6 4h4.5A1.5 1.5 0 0 1 12 5.5V10A1.5 1.5 0 0 1 10.5 11.5H6A1.5 1.5 0 0 1 4.5 10V5.5Zm7.5 0A1.5 1.5 0 0 1 13.5 4H18A1.5 1.5 0 0 1 19.5 5.5V8A1.5 1.5 0 0 1 18 9.5h-4.5A1.5 1.5 0 0 1 12 8V5.5ZM4.5 14A1.5 1.5 0 0 1 6 12.5h4.5A1.5 1.5 0 0 1 12 14v4.5A1.5 1.5 0 0 1 10.5 20H6A1.5 1.5 0 0 1 4.5 18.5V14Zm7.5 2A1.5 1.5 0 0 1 13.5 14.5H18A1.5 1.5 0 0 1 19.5 16v2.5A1.5 1.5 0 0 1 18 20h-4.5A1.5 1.5 0 0 1 12 18.5V16Z"
              />
            </svg>
          </span>
          <span className="quick-action-label">Tools</span>
        </Link>
      </div>

      <div className="mode-row">
        <Link href="/scan" className="mode-card pressable">
          <span className="mode-title">Document</span>
          <span className="mode-desc">Multi-page scan, enhance, OCR, PDF</span>
        </Link>
        <Link href="/scan?mode=id_card" className="mode-card accent pressable">
          <span className="mode-title">CNIC</span>
          <span className="mode-desc">Pakistani ID · front + back</span>
        </Link>
      </div>

      <div className="section-head">
        <h2>Recent</h2>
      </div>
      <DocumentLibrary />

      <Link href="/scan" className="fab" aria-label="New scan">
        <span className="fab-icon" aria-hidden>
          +
        </span>
        <span className="fab-label">Scan</span>
      </Link>
    </main>
  );
}
