import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Docupros Android shell.
 *
 * Real-time updates: the WebView loads the live site, so every Vercel
 * deploy is available on the next app open — no Play Store wait for UI fixes.
 * Bundled `out/` is still synced for offline / first paint when the network fails.
 */
const LIVE_URL =
  process.env.DOCUPROS_LIVE_URL?.trim() || "https://docupros.vercel.app";

const useLiveShell = process.env.DOCUPROS_BUNDLED_ONLY !== "1";

const config: CapacitorConfig = {
  appId: "app.docupros.scanner",
  appName: "Docupros",
  webDir: "out",
  backgroundColor: "#0f766e",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0f766e",
    webContentsDebuggingEnabled: process.env.NODE_ENV !== "production",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0f766e",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f766e",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  server: useLiveShell
    ? {
        url: LIVE_URL,
        cleartext: false,
        allowNavigation: [
          "docupros.vercel.app",
          "*.vercel.app",
          "localhost",
          "127.0.0.1",
        ],
      }
    : undefined,
};

export default config;
