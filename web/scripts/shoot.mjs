// Viewport-by-viewport screenshots at desktop and phone widths (headless Edge).
//   npm run preview   (in another terminal)  then   npm run shoot
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.env.URL || "http://localhost:4173/";
const OUT = new URL("../.shots/", import.meta.url);
const ONLY = process.argv[2]; // optional: "d" or "m"
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage();
for (const [w, h, tag] of [
  [1440, 900, "d"],
  [390, 844, "m"],
]) {
  if (ONLY && ONLY !== tag) continue;
  await page.setViewport({ width: w, height: h });
  await page.goto(URL_, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 4200)); // let the hero sequence finish
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`${tag}: ${w}x${h}, page height ${H}`);
  for (let y = 0, i = 0; y < H; y += h * 0.9, i++) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: fileURLToPath(new URL(`${tag}-${String(i).padStart(2, "0")}.png`, OUT)) });
  }
}
await browser.close();
