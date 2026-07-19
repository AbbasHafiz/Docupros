/** Escape text for safe use inside HTML. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Open a print tab immediately (must run in the same user-gesture turn).
 * Do NOT pass `noopener` — that makes browsers return null / block document.write,
 * leaving a stuck blank white tab.
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

/** Wait for images, open the print dialog, then close the tab. */
export function triggerPrintWhenReady(w: Window) {
  const runPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      // Print may be blocked; leave the tab open so the user can print manually
    }
  };

  const imgs = Array.from(w.document.images);
  const wait =
    imgs.length === 0
      ? Promise.resolve()
      : Promise.all(
          imgs.map(
            (img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.addEventListener("load", () => resolve(), { once: true });
                    img.addEventListener("error", () => resolve(), { once: true });
                  }),
          ),
        );

  void wait.then(() => {
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
  // Fallback if afterprint never fires (some mobile browsers)
  window.setTimeout(closeLater, 120_000);
}
