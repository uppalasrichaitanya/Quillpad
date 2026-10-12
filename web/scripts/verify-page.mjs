// Acceptance checks for the landing page, in headless Edge.
//   npm run build && npm run preview   (another terminal)   then   npm run verify
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = process.env.URL || "http://localhost:4173/";
const MAX_HEIGHT = 6000;
const release = readFileSync(new URL("../src/release.ts", import.meta.url), "utf8");
const RELEASE_URL = release.match(/"url": "([^"]+)"/)[1];

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions(new URL(BASE).origin, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
const page = await browser.newPage();

const errors = [];
const foreign = new Set();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("request", (r) => {
  const u = new URL(r.url());
  if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) foreign.add(u.origin);
});

// ---- desktop ----
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle0" });
await sleep(4200);

const height = await page.evaluate(() => document.documentElement.scrollHeight);
check(`page height at 1440 ≤ ${MAX_HEIGHT}px`, height <= MAX_HEIGHT, `${height}px`);
check("no horizontal overflow at 1440", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

const headings = await page.$$eval("h1,h2,h3", (els) => els.map((e) => Number(e.tagName[1])));
const h1s = headings.filter((h) => h === 1).length;
const skips = headings.some((h, i) => i > 0 && h > headings[i - 1] + 1);
check("exactly one h1, no skipped heading levels", h1s === 1 && !skips, headings.join(""));

const bodyText = await page.evaluate(() => document.body.innerText);
const banned = ["seekai", "gorouter", "inception", ".env"].filter((w) => bodyText.toLowerCase().includes(w));
check("no third-party provider names or .env on the page", banned.length === 0, banned.join(", "));

// Every visible text node against the nearest opaque background behind it.
const contrast = await page.evaluate(() => {
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c.length >= 3 && (c[3] ?? 1) > 0.9) return c;
    }
    return [20, 17, 13];
  };
  const fails = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode()); ) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el || el.closest('[aria-hidden="true"],.sr-only,svg')) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    // skip anything faded by an ancestor (e.g. the off-screen half of a flipped card)
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    if (o < 0.95) continue;
    const fg = parse(cs.color);
    const a = fg[3] ?? 1;
    const bg = bgOf(el);
    const mixed = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
    const [l1, l2] = [lum(mixed), lum(bg)].sort((x, y) => y - x);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) fails.push(`${ratio.toFixed(2)} "${n.textContent.trim().slice(0, 30)}"`);
  }
  return fails;
});
check("text contrast meets WCAG AA", contrast.length === 0, contrast.slice(0, 4).join(" | "));

// Ask demo
await page.$eval("#mini-ask", (e) => e.scrollIntoView({ block: "center" }));
await page.type("#mini-ask", "mitochondria");
await sleep(300);
const ask = await page.$eval('[data-testid="ask-result"]', (e) => e.textContent);
check('ask demo: "mitochondria" finds Biology · Chapter 04', /Biology · Chapter 04/.test(ask), ask.slice(0, 60));

// Flashcard
await page.focus('[data-testid="flashcard"]');
await page.keyboard.press("Space");
await sleep(600);
check("flashcard flips on Space", (await page.$eval('[data-testid="flashcard"]', (e) => e.dataset.flipped)) === "true");

// Download + checksum
const href = await page.$eval('[data-testid="download-link"]', (e) => e.href);
check("download link points at the GitHub release", href === RELEASE_URL, href);
await page.$eval('[data-testid="copy-sha"]', (e) => e.click());
await sleep(300);
check("checksum copy confirms", (await page.$eval('[data-testid="copy-sha"]', (e) => e.textContent)) === "Copied");

// ---- mobile ----
await page.setViewport({ width: 390, height: 844 });
await page.goto(BASE, { waitUntil: "networkidle0" });
await sleep(1500);
check("no horizontal overflow at 390", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  await page.evaluate(() => `${document.documentElement.scrollWidth}px`));

// ---- reduced motion ----
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle0" });
await sleep(300);
const settled = await page.evaluate(() => {
  const note = document.querySelector('[data-testid="hero-note-title"]');
  let o = 1;
  for (let e = note; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
  return o;
});
check("reduced motion shows the finished note immediately", settled > 0.95, `opacity ${settled.toFixed(2)}`);

check("no requests to other origins", foreign.size === 0, [...foreign].join(", "));
const realErrors = errors.filter((e) => !/favicon/.test(e));
check("no console or page errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
