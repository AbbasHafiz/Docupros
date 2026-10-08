"use client";

import { useEffect } from "react";
import { initNativeShell, initViewportLock } from "@/lib/nativeShell";

/** Boots Capacitor plugins + locks viewport height for native-fit layouts. */
export function NativeShellInit() {
  useEffect(() => {
    initViewportLock();
    void initNativeShell();
  }, []);

  return null;
}
