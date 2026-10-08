# Docupros Android app

Native Android shell (Capacitor) around the Docupros web app.

## Real-time updates

By default the app WebView loads **https://docupros.vercel.app**.

When you push to `main` and Vercel redeploys, opening the Android app shows the new UI immediately — no Play Store wait for web/feature changes.

Native permission or plugin changes still need a new APK.

## Build & install (debug APK)

```bash
npm install
npm run android:sync          # build web + sync into android/
npm run android:open          # opens Android Studio
```

In Android Studio: **Run ▶** on a device/emulator, or:

```bash
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a phone:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Modes

| Command | Behavior |
|---------|----------|
| `npm run android:live` | Live shell (default) — loads Vercel URL, realtime updates |
| `npm run android:bundled` | Offline shell — only ships files from `out/` |

Override the live host:

```bash
DOCUPROS_LIVE_URL=https://your-preview.vercel.app npm run android:sync
```

## Package

- **App id:** `app.docupros.scanner`
- **Name:** Docupros
- **Permissions:** Internet, Camera, Photos (for scan / import)

## Release APK / Play Store

1. Create a keystore and configure signing in `android/app/build.gradle`
2. `cd android && ./gradlew assembleRelease` (or `bundleRelease` for AAB)
3. Upload to Play Console

Web-only fixes keep shipping through Vercel to existing installs automatically.
