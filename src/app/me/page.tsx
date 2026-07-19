import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function MePage() {
  return (
    <main className="home android-page">
      <AppHeader title="Me" />
      <section className="profile-card">
        <div className="profile-avatar" aria-hidden>
          D
        </div>
        <div>
          <h2 className="profile-name">Docupros</h2>
          <p className="hint">Local-first scanner · no account needed</p>
        </div>
      </section>

      <div className="settings-list">
        <Link href="/tools" className="settings-row pressable">
          <span>Tools</span>
          <span className="settings-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link href="/import" className="settings-row pressable">
          <span>Import PDF</span>
          <span className="settings-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link href="/tools/collage" className="settings-row pressable">
          <span>Collage</span>
          <span className="settings-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <Link href="/tools/remove-background" className="settings-row pressable">
          <span>Remove Background</span>
          <span className="settings-chevron" aria-hidden>
            ›
          </span>
        </Link>
      </div>

      <div className="text-edit-box about-card">
        <p className="subhead">About</p>
        <p className="hint">
          Capture, enhance, edit, form fill, convert, print, collage, and lock
          documents in your browser — CamScanner-style, phone-first.
        </p>
        <p className="developer-credit">This tool developed by Hafiz Abbas</p>
      </div>
    </main>
  );
}
