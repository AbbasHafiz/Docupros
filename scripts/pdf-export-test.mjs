/**
 * Verify PDF export embeds visible page content (not blank).
 */
import { chromium } from "playwright-core";
import { createRequire } from "module";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const require = createRequire(import.meta.url);
const { PDFDocument } = require("pdf-lib");

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
  "base64",
);

async function main() {
  // Restart expectation: serve out/ on 3000
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const page = await browser.newPage();

  // Capture downloads
  const downloadPromise = page.waitForEvent("download", { timeout: 20000 });

  await page.goto(BASE + "/tools/import-images", { waitUntil: "networkidle" });
  await page.locator("label.field input").first().fill("PDF Export Test");
  await page.setInputFiles('input[type="file"]', {
    name: "page.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.waitForURL(/document\?id=/, { timeout: 15000 });
  await page.waitForTimeout(600);

  // Export PDF (uses PNG source — the bug case)
  await page.getByRole("button", { name: /Export PDF/i }).click();
  const download = await downloadPromise;
  const path = "/tmp/docupros-export-test.pdf";
  await download.saveAs(path);

  const fs = await import("fs");
  const bytes = fs.readFileSync(path);
  console.log("PDF size:", bytes.length);
  if (bytes.length < 800) {
    console.error("FAIL: PDF too small — likely blank");
    process.exit(1);
  }

  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPageCount();
  console.log("PDF pages:", pages);
  if (pages < 1) {
    console.error("FAIL: no pages");
    process.exit(1);
  }

  // Scan crop tools
  await page.goto(BASE + "/scan", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', {
    name: "scan.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.waitForTimeout(1500);
  const body = await page.textContent("body");
  const hasAuto = body?.includes("Auto crop");
  const hasRotL = body?.includes("Rotate left");
  const hasRotR = body?.includes("Rotate right");
  console.log({ hasAuto, hasRotL, hasRotR });
  if (!hasAuto || !hasRotL || !hasRotR) {
    console.error("FAIL: crop/rotate tools missing on scan crop step");
    process.exit(1);
  }

  console.log("PASS: PDF export has content; scan crop/rotate tools present");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
