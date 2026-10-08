#!/usr/bin/env node
/**
 * Writes public/version.json (and out/version.json after build) so the Android
 * shell can show that it is on the latest deploy.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function git(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const version = {
  name: "Docupros",
  version: process.env.npm_package_version || "0.1.0",
  buildId:
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    git("git rev-parse --short HEAD") ||
    `local-${Date.now()}`,
  builtAt: new Date().toISOString(),
  liveUrl: process.env.DOCUPROS_LIVE_URL || "https://docupros.vercel.app",
};

const targets = [join(root, "public", "version.json")];
if (existsSync(join(root, "out"))) {
  targets.push(join(root, "out", "version.json"));
}

for (const file of targets) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(version, null, 2)}\n`);
}

console.log(`Wrote version ${version.buildId} → ${targets.join(", ")}`);
