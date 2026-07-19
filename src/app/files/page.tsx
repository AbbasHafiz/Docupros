import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DocumentLibrary } from "@/components/DocumentLibrary";

export default function FilesPage() {
  return (
    <main className="home files-page android-page">
      <AppHeader title="Files" />
      <p className="page-subhead">Documents saved on this device</p>
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
