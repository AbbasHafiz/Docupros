"use client";

import { useEffect } from "react";
import { initNativeShell } from "@/lib/nativeShell";

/** Boots Capacitor plugins when running inside the Android app. */
export function NativeShellInit() {
  useEffect(() => {
    void initNativeShell();
  }, []);

  return null;
}
