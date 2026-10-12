/** Screenshots the hero as public/og.png (1200x630).
 *  Usage: node scripts/make-og.mjs [--url=http://localhost:4173] */

import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const urlArg = argv.find((a) => a.startsWith("--url="));
const URL = urlArg ? urlArg.split("=")[1] : "http://localhost:4173";

const EDGES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const EDGE = EDGES.find((p) => fs.existsSync(p));
if (!EDGE) {
  console.error("FATAL: Edge not found");
  process.exit(1);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "public");
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  args: ["--enable-unsafe-swiftshader", "--disable-gpu-sandbox", "--no-sandbox"],
  defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4500));
  const target = path.join(outDir, "og.png");
  await page.screenshot({
    path: target,
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  // Push the fresh image into any build already on disk: Vite copies public/
  // at build time, so regenerating afterwards would otherwise leave dist
  // serving the previous card.
  const bytes = fs.readFileSync(target);
  for (const dir of ["dist"]) {
    const built = path.join(root, dir);
    if (!fs.existsSync(built)) continue;
    fs.writeFileSync(path.join(built, "og.png"), bytes);
    console.log(`synced ${dir}/og.png`);
  }
  const size = fs.statSync(target).size;
  console.log(`og.png written: ${Math.round(size / 1024)} KB`);
} finally {
  await browser.close();
}
