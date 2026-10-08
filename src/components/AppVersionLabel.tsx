"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/nativeShell";

type VersionInfo = {
  version?: string;
  buildId?: string;
  liveUrl?: string;
};

export function AppVersionLabel() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
    void fetch("/version.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: VersionInfo | null) => {
        if (data) setInfo(data);
      })
      .catch(() => undefined);
  }, []);

  if (!info?.version && !info?.buildId) return null;

  return (
    <p className="hint" style={{ marginTop: "0.75rem" }}>
      {native ? "Android app · live updates · " : ""}v{info.version || "0.1.0"}
      {info.buildId ? ` · ${info.buildId}` : ""}
    </p>
  );
}
