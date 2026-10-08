import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Download Android app · Docupros",
  description: "Download the Docupros Android APK or ZIP installer.",
};

export default function DownloadPage() {
  return (
    <main className="home android-page">
      <AppHeader title="Get Android app" />
      <section className="text-edit-box about-card">
        <p className="subhead">Install Docupros</p>
        <p className="hint">
          Chrome sometimes blocks raw APK links. Use the ZIP download first —
          then open <code>Docupros.apk</code> inside it.
        </p>
        <div className="action-row" style={{ marginTop: "1rem", gap: "0.65rem" }}>
          <a className="btn primary pressable" href="/downloads/Docupros.zip" download>
            Download ZIP
          </a>
          <a className="btn ghost pressable" href="/downloads/Docupros.apk" download>
            Download APK
          </a>
        </div>
        <ol className="hint" style={{ marginTop: "1rem", paddingLeft: "1.2rem" }}>
          <li>Wait for the ~14 MB file to finish.</li>
          <li>Open it (extract ZIP if needed).</li>
          <li>Allow install from Files / Chrome if Android asks.</li>
          <li>Open Docupros and allow Camera.</li>
        </ol>
        <p className="hint" style={{ marginTop: "0.85rem" }}>
          Mirror page:{" "}
          <Link href="/downloads/">docupros.vercel.app/downloads/</Link>
        </p>
      </section>
    </main>
  );
}
