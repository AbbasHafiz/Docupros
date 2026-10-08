# Docupros

CamScanner-style scanner with a full **Tools** hub.

## Live demo

**https://aged-water-1105.zerodeploy.app**

(Free ZeroDeploy link — expires in ~72 hours unless claimed. Camera needs HTTPS, which this URL provides.)

## App tabs
Home · Files · **Tools** · Me

## Tools (from CamScanner Tools screen)

| Section | Ready | Soon |
|---------|-------|------|
| **Scan** | ID Cards, Extract Text, ID Photo, Book, Slides, Whiteboard, Timestamp | Formula, Photo Translate |
| **Import** | Import Images, Import Files (PDF) | — |
| **Convert** | To Word, To Excel (CSV), PDF to Images, PDF to Long Image | To PPT |
| **Edit** | Sign, Watermark, Smart Erase, Remove Handwriting, Restore, Merge, Extract Pages, Reorder, Lock, Form Fill | — |
| **Utilities** | Print, ID Print | Scan Code, AI |

## Run locally

```bash
npm install
npm run dev
```

Production static build:

```bash
npm run build
npm start
```

Open **Tools** in the bottom nav.

## Android app (realtime updates)

Native Android wrapper (Capacitor). The app loads **https://docupros.vercel.app**, so every web deploy is live on the next open.

```bash
npm install
npm run android:sync    # build site + sync into android/
npm run android:open    # Android Studio
```

See **[ANDROID.md](./ANDROID.md)** for APK build, live vs bundled mode, and Play Store notes.

**Direct install (phone):** open https://docupros.vercel.app/download — use the ZIP if Chrome blocks the APK.

## Hosting notes

- App is a static export (`output: "export"`) — all data stays in the browser (IndexedDB).
- Permanent free hosting: connect the GitHub repo to [Vercel](https://vercel.com/new) (one click), or claim the ZeroDeploy drop from the deploy response.
- Live demo: **https://docupros.vercel.app**
