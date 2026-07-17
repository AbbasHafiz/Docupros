/**
 * Functional smoke tests for Docupros operations.
 * Run: node scripts/smoke-test.mjs
 */
import { chromium } from "playwright-core";
import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const require = createRequire(import.meta.url);

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`);
}

async function makeTestPng() {
  // 1x1 white PNG
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
    "base64",
  );
}

async function makeTestJpegDataUrl() {
  // Minimal via canvas in browser later
  return null;
}

async function main() {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const context = await browser.newContext({
    permissions: ["camera"],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // --- Routes smoke ---
  const routes = [
    "/",
    "/files",
    "/tools",
    "/me",
    "/scan",
    "/import",
    "/tools/import-images",
    "/tools/extract-text",
    "/tools/merge",
    "/tools/extract-pages",
    "/tools/lock",
    "/tools/restore",
    "/tools/remove-handwriting",
    "/tools/to-word",
    "/tools/to-excel",
    "/tools/pdf-images",
    "/tools/pdf-long",
    "/tools/id-photo",
    "/tools/timestamp",
    "/tools/pick?action=sign",
    "/tools/soon?name=Formula",
    "/document",
    "/document/edit",
    "/document/form",
  ];

  for (const route of routes) {
    const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const status = res?.status() ?? 0;
    if (status >= 200 && status < 400) pass(`route ${route}`, `HTTP ${status}`);
    else fail(`route ${route}`, `HTTP ${status}`);
  }

  // --- Gallery input must NOT force camera ---
  await page.goto(BASE + "/scan", { waitUntil: "networkidle" });
  const captureAttr = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    return inputs.map((i) => ({
      accept: i.getAttribute("accept"),
      capture: i.getAttribute("capture"),
    }));
  });
  const galleryOk = captureAttr.every((i) => !i.capture);
  if (galleryOk) pass("gallery file input has no capture attr", JSON.stringify(captureAttr));
  else fail("gallery file input forces camera", JSON.stringify(captureAttr));

  const galleryBtn = page.getByRole("button", { name: "Gallery" });
  if (await galleryBtn.count()) pass("gallery button present");
  else fail("gallery button present");

  // --- Import images into IndexedDB via tool ---
  await page.goto(BASE + "/tools/import-images", { waitUntil: "networkidle" });
  const png = await makeTestPng();
  await page.setInputFiles('input[type="file"]', {
    name: "test-page.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.waitForURL(/document\?id=/, { timeout: 15000 }).catch(() => null);
  const url = page.url();
  if (url.includes("document?id=")) {
    pass("import images saves and opens document", url);
    // Viewer should not say not found forever
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (body?.includes("Document not found")) fail("viewer shows not found after import");
    else if (body?.includes("Loading")) {
      await page.waitForTimeout(1000);
      const body2 = await page.textContent("body");
      if (body2?.includes("Document not found")) fail("viewer not found after load");
      else pass("document viewer loads imported doc");
    } else pass("document viewer loads imported doc");

    // Image should be present
    const imgs = await page.locator(".doc-stage img, .page-view img, img").count();
    if (imgs > 0) pass("document shows page image", `imgs=${imgs}`);
    else {
      // Maybe different selector
      const hasCanvas = await page.locator("canvas").count();
      if (hasCanvas > 0) pass("document shows canvas page");
      else fail("document shows page image", "no img/canvas");
    }
  } else {
    fail("import images saves and opens document", url);
  }

  // --- Tools hub links ---
  await page.goto(BASE + "/tools", { waitUntil: "networkidle" });
  const toolLinks = await page.locator("a[href^='/tools'], a[href^='/scan'], a[href^='/import']").count();
  if (toolLinks >= 10) pass("tools hub has links", `count=${toolLinks}`);
  else fail("tools hub has links", `count=${toolLinks}`);

  // --- PDF import page renders without crash ---
  await page.goto(BASE + "/import", { waitUntil: "networkidle" });
  const importTitle = await page.textContent("body");
  if (importTitle?.includes("Import PDF") || importTitle?.includes("PDF"))
    pass("import PDF page loads");
  else fail("import PDF page loads");

  // --- Create minimal PDF and import ---
  // Build a tiny PDF with pdf-lib in page context
  const pdfBytes = await page.evaluate(async () => {
    const { PDFDocument, StandardFonts } = await import(
      "https://cdn.skypack.dev/pdf-lib"
    ).catch(() => ({ PDFDocument: null }));
    if (!PDFDocument) return null;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 600]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Docupros test page", { x: 50, y: 500, size: 18, font });
    const bytes = await pdf.save();
    return Array.from(bytes);
  });

  if (pdfBytes) {
    await page.goto(BASE + "/import", { waitUntil: "networkidle" });
    await page.setInputFiles('input[type="file"]', {
      name: "sample.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdfBytes),
    });
    // Wait for page thumbnails or status
    await page.waitForTimeout(4000);
    const body = await page.textContent("body");
    if (body?.includes("Loaded") || body?.includes("page")) {
      pass("PDF import renders pages", body.slice(0, 120));
      const saveBtn = page.getByRole("button", { name: /Save/i });
      if (await saveBtn.count()) {
        await saveBtn.first().click();
        await page.waitForURL(/document\?id=/, { timeout: 15000 }).catch(() => null);
        if (page.url().includes("document?id=")) {
          pass("PDF import save opens viewer", page.url());
          await page.waitForTimeout(800);
          const b = await page.textContent("body");
          if (b?.includes("Document not found")) fail("imported PDF viewer missing");
          else pass("imported PDF visible in viewer");
        } else fail("PDF import save opens viewer", page.url());
      }
    } else {
      fail("PDF import renders pages", body?.slice(0, 200) || "empty");
    }
  } else {
    // Fallback: generate PDF with pdf-lib from node if available
    try {
      const { PDFDocument, StandardFonts } = await import(
        "/workspace/node_modules/pdf-lib/es/index.js"
      );
      const pdf = await PDFDocument.create();
      const p = pdf.addPage([400, 600]);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      p.drawText("Docupros test page", { x: 50, y: 500, size: 18, font });
      const bytes = await pdf.save();
      await page.goto(BASE + "/import", { waitUntil: "networkidle" });
      await page.setInputFiles('input[type="file"]', {
        name: "sample.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(bytes),
      });
      await page.waitForTimeout(5000);
      const body = await page.textContent("body");
      if (body?.includes("Loaded") || (await page.locator(".page-thumb img").count()) > 0) {
        pass("PDF import renders pages (node pdf-lib)");
        await page.getByRole("button", { name: /Save/i }).first().click();
        await page.waitForURL(/document\?id=/, { timeout: 15000 }).catch(() => null);
        if (page.url().includes("document?id=")) pass("PDF import save opens viewer");
        else fail("PDF import save opens viewer", page.url());
      } else fail("PDF import renders pages", body?.slice(0, 200) || "");
    } catch (e) {
      fail("PDF import test setup", String(e));
    }
  }

  // --- Merge / lock / extract pages pages load with picker ---
  for (const r of ["/tools/merge", "/tools/lock", "/tools/extract-pages", "/tools/restore"]) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    const t = await page.textContent("body");
    if (t && !t.includes("Application error")) pass(`tool page ${r}`);
    else fail(`tool page ${r}`);
  }

  // --- Storage round-trip via page evaluate ---
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const stored = await page.evaluate(async () => {
    const { openDB } = await import("https://cdn.skypack.dev/idb").catch(() => ({}));
    // Use app's IDB directly
    return new Promise((resolve) => {
      const req = indexedDB.open("docupros");
      req.onerror = () => resolve({ ok: false, err: "open failed" });
      req.onsuccess = () => {
        const db = req.result;
        const names = [...db.objectStoreNames];
        if (!names.length) {
          resolve({ ok: false, err: "no stores", names });
          return;
        }
        const tx = db.transaction(names[0], "readonly");
        const store = tx.objectStore(names[0]);
        const getAll = store.getAll();
        getAll.onsuccess = () =>
          resolve({ ok: true, count: getAll.result.length, names });
        getAll.onerror = () => resolve({ ok: false, err: "getAll failed" });
      };
    });
  });
  if (stored.ok && stored.count > 0)
    pass("IndexedDB has documents", `count=${stored.count}`);
  else if (stored.ok) fail("IndexedDB has documents", "count=0");
  else fail("IndexedDB access", JSON.stringify(stored));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  writeFileSync(
    "/opt/cursor/artifacts/smoke-test-results.json",
    JSON.stringify({ base: BASE, results, consoleErrors: consoleErrors.slice(0, 30) }, null, 2),
  );
  console.log("\n--- Summary ---");
  console.log(`Passed: ${results.filter((r) => r.ok).length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  • ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
