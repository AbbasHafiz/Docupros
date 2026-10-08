/** Escape text for safe use inside HTML. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PREVIEW_HOST_ID = "docupros-print-host";

function removePrintHost() {
  document.getElementById(PREVIEW_HOST_ID)?.remove();
}

/**
 * Open a print tab immediately (must run in the same user-gesture turn).
 * Prefer {@link printHtml} — pop-ups are blocked in Android WebView / Capacitor.
 */
export function openPrintWindow(title = "Print"): Window {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) {
    throw new Error("Pop-up blocked — allow pop-ups to print");
  }
  w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      font-family: system-ui, sans-serif;
      background: #f8fafc;
      color: #334155;
    }
    .msg {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 1.5rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <p class="msg">Preparing print…</p>
</body>
</html>`);
  w.document.close();
  return w;
}

/** Replace the print tab contents with the final printable HTML. */
export function writePrintDocument(w: Window, html: string) {
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function waitForImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.images);
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  ).then(() => undefined);
}

function callPrint(target: Window) {
  try {
    target.focus();
  } catch {
    /* ignore */
  }
  target.print();
}

/** Wait for images, open the print dialog, then close the tab. */
export function triggerPrintWhenReady(w: Window) {
  const runPrint = () => {
    try {
      callPrint(w);
    } catch {
      // Print may be blocked; leave the tab open so the user can print manually
    }
  };

  void waitForImages(w.document).then(() => {
    window.setTimeout(runPrint, 150);
  });

  const closeLater = () => {
    window.setTimeout(() => {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }, 400);
  };
  w.addEventListener("afterprint", closeLater);
  window.setTimeout(closeLater, 120_000);
}

/**
 * In-app print preview → Android/Chrome system print dialog (printers, PDF, etc.).
 * Works in Capacitor WebView where `window.open` is blocked and after async work
 * where the original user-gesture is gone.
 */
export async function printHtml(
  html: string,
  title = "Print",
  options?: { autoPrint?: boolean },
): Promise<void> {
  removePrintHost();

  const host = document.createElement("div");
  host.id = PREVIEW_HOST_ID;
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-label", title);
  host.innerHTML = `
    <style>
      #${PREVIEW_HOST_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        flex-direction: column;
        background: #0f172a;
        color: #f8fafc;
        font-family: system-ui, -apple-system, sans-serif;
      }
      #${PREVIEW_HOST_ID} .dp-top {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.75rem 0.9rem;
        padding-top: calc(0.75rem + env(safe-area-inset-top, 0px));
        background: #115e59;
      }
      #${PREVIEW_HOST_ID} .dp-title {
        flex: 1;
        min-width: 0;
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${PREVIEW_HOST_ID} .dp-frame-wrap {
        flex: 1;
        min-height: 0;
        background: #e2e8f0;
        padding: 0.65rem;
      }
      #${PREVIEW_HOST_ID} iframe {
        width: 100%;
        height: 100%;
        border: 0;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 8px 28px rgba(15, 23, 42, 0.25);
      }
      #${PREVIEW_HOST_ID} .dp-actions {
        flex-shrink: 0;
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: 0.55rem;
        padding: 0.75rem 0.9rem;
        padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
        background: #fff;
        color: #0f172a;
        border-top: 1px solid #e2e8f0;
      }
      #${PREVIEW_HOST_ID} button {
        min-height: 3rem;
        border: 0;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
      }
      #${PREVIEW_HOST_ID} .dp-cancel {
        background: #e2e8f0;
        color: #334155;
      }
      #${PREVIEW_HOST_ID} .dp-print {
        background: #0f766e;
        color: #fff;
      }
      #${PREVIEW_HOST_ID} .dp-hint {
        margin: 0;
        padding: 0 0.9rem 0.55rem;
        background: #fff;
        color: #64748b;
        font-size: 0.8rem;
        text-align: center;
      }
      @media print {
        body > *:not(#${PREVIEW_HOST_ID}) { display: none !important; }
        #${PREVIEW_HOST_ID} {
          position: static !important;
          inset: auto !important;
          background: #fff !important;
          color: #000 !important;
        }
        #${PREVIEW_HOST_ID} .dp-top,
        #${PREVIEW_HOST_ID} .dp-actions,
        #${PREVIEW_HOST_ID} .dp-hint { display: none !important; }
        #${PREVIEW_HOST_ID} .dp-frame-wrap {
          padding: 0 !important;
          background: #fff !important;
        }
        #${PREVIEW_HOST_ID} iframe {
          position: fixed !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
      }
    </style>
    <div class="dp-top">
      <h2 class="dp-title">${escapeHtml(title)}</h2>
    </div>
    <div class="dp-frame-wrap">
      <iframe title="Print preview"></iframe>
    </div>
    <p class="dp-hint">Choose your printer in the system dialog (or Save as PDF).</p>
    <div class="dp-actions">
      <button type="button" class="dp-cancel">Cancel</button>
      <button type="button" class="dp-print">Print to printer</button>
    </div>
  `;

  document.body.appendChild(host);
  const iframe = host.querySelector("iframe");
  const printBtn = host.querySelector<HTMLButtonElement>(".dp-print");
  const cancelBtn = host.querySelector<HTMLButtonElement>(".dp-cancel");
  if (!iframe || !printBtn || !cancelBtn) {
    removePrintHost();
    throw new Error("Could not open print preview");
  }

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    removePrintHost();
    throw new Error("Could not open print preview");
  }

  doc.open();
  doc.write(html);
  doc.close();
  await waitForImages(doc);
  // Give the layout a tick to paint before offering print
  await new Promise<void>((r) => window.setTimeout(r, 80));

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      removePrintHost();
      resolve();
    };

    cancelBtn.addEventListener("click", finish, { once: true });

    const doPrint = () => {
      try {
        callPrint(win);
      } catch {
        try {
          // Last resort: print the host/iframe via the top window
          callPrint(window);
        } catch {
          alert(
            "Print dialog could not open. Try Chrome menu → Share → Print, or export PDF first.",
          );
        }
      }
    };

    printBtn.addEventListener("click", doPrint);
    win.addEventListener("afterprint", () => {
      window.setTimeout(finish, 250);
    });

    if (options?.autoPrint) {
      window.setTimeout(doPrint, 200);
    } else {
      // Desktop / tablet: auto-open system dialog; keep preview as backup
      const ua = navigator.userAgent || "";
      const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
      if (!isMobile) {
        window.setTimeout(doPrint, 250);
      }
    }
  });
}

/**
 * Begin a print session with a loading preview, then swap in final HTML.
 * Use this when page images must be prepared asynchronously.
 */
export function openPrintPreviewSession(title = "Print"): {
  setHtml: (html: string) => Promise<void>;
  close: () => void;
} {
  removePrintHost();
  const host = document.createElement("div");
  host.id = PREVIEW_HOST_ID;
  host.innerHTML = `
    <style>
      #${PREVIEW_HOST_ID} {
        position: fixed; inset: 0; z-index: 2147483000;
        display: grid; place-items: center;
        background: rgba(15, 23, 42, 0.72);
        color: #f8fafc; font-family: system-ui, sans-serif;
        padding: 1.25rem;
      }
      #${PREVIEW_HOST_ID} .dp-loading {
        background: #115e59; border-radius: 16px;
        padding: 1.25rem 1.5rem; text-align: center;
        box-shadow: 0 12px 40px rgba(0,0,0,.35);
        max-width: 18rem;
      }
      #${PREVIEW_HOST_ID} .dp-loading p { margin: 0.35rem 0 0; opacity: .9; font-size: .92rem; }
      #${PREVIEW_HOST_ID} .dp-loading strong { font-size: 1.05rem; }
    </style>
    <div class="dp-loading" role="status">
      <strong>${escapeHtml(title)}</strong>
      <p>Preparing pages for your printer…</p>
    </div>
  `;
  document.body.appendChild(host);

  return {
    close: removePrintHost,
    async setHtml(html: string) {
      removePrintHost();
      await printHtml(html, title);
    },
  };
}
