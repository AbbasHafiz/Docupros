/**
 * Capacitor native shell helpers — status bar, splash, Android back button.
 * Safe no-ops when running in a regular browser.
 */

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (
    window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export async function initNativeShell(): Promise<void> {
  if (typeof window === "undefined" || !isNativeApp()) return;

  try {
    const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import("@capacitor/app"),
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
    ]);

    document.documentElement.classList.add("is-native-app");
    document.body.classList.add("is-native-app");

    await StatusBar.setBackgroundColor({ color: "#0f766e" }).catch(() => undefined);
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
    await SplashScreen.hide().catch(() => undefined);

    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      void App.exitApp();
    });

    // Soft realtime check: if live site has a newer buildId, reload once.
    void checkLiveUpdate();
  } catch {
    // Plugins unavailable — still fine as a PWA / browser.
  }
}

async function checkLiveUpdate(): Promise<void> {
  try {
    const localRes = await fetch("/version.json", { cache: "no-store" });
    const remoteRes = await fetch("https://docupros.vercel.app/version.json", {
      cache: "no-store",
    });
    if (!localRes.ok || !remoteRes.ok) return;
    const local = (await localRes.json()) as { buildId?: string };
    const remote = (await remoteRes.json()) as { buildId?: string };
    if (!local.buildId || !remote.buildId || local.buildId === remote.buildId) {
      return;
    }
    const key = `docupros-reload-${remote.buildId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  } catch {
    // Offline or CORS — ignore; live shell already loads remote URL.
  }
}
