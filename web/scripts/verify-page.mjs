/** Browser acceptance suite for the field-notebook Quillpad landing page.
 *  Drives real Edge via puppeteer-core against a running preview.
 *  Usage: node scripts/verify-page.mjs [--url=http://localhost:4173] */

import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const urlArg = argv.find((a) => a.startsWith("--url="));
const PAGE_URL = urlArg ? urlArg.split("=")[1] : "http://localhost:4173";

const EDGES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const EDGE = EDGES.find((p) => fs.existsSync(p));
if (!EDGE) {
  console.error("FATAL: Edge not found at either known path");
  process.exit(1);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dlSrc = fs.readFileSync(
  path.join(root, "src", "download-info.ts"),
  "utf8"
);
const sha = dlSrc.match(/sha256:\s*"([0-9a-f]+)"/)?.[1];
const size = Number(dlSrc.match(/sizeBytes:\s*(\d+)/)?.[1]);
const exePath = path.join(root, "public", "download", "Quillpad.exe");

let failures = 0;
const results = [];
function check(name, fn) {
  return (async () => {
    try {
      await fn();
      results.push(`PASS ${name}`);
    } catch (e) {
      failures++;
      results.push(`FAIL ${name}: ${e.message}`);
    }
  })();
}

/** True only if a text node is actually perceivable: laid out, opaque, on
 *  screen, not clipped away, and not screen-reader-only. The old version
 *  accepted any non-zero box, so it matched the hero title, the always-mounted
 *  card back, and .sr-only sidebar text — and passed while the feature broke. */
async function textVisible(page, text, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = await page.evaluate((t) => {
      const lower = t.toLowerCase();
      for (const node of document.querySelectorAll("body *")) {
        if (node.children.length !== 0) continue;
        if (!node.textContent.toLowerCase().includes(lower)) continue;
        if (node.closest(".sr-only")) continue;
        const style = getComputedStyle(node);
        if (style.visibility === "hidden" || style.display === "none") continue;
        if (Number(style.opacity) === 0) continue;
        if (node.closest('[aria-hidden="true"]')) continue;
        const r = node.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        // in the viewport, not merely laid out somewhere off-page
        if (r.bottom <= 0 || r.top >= innerHeight) continue;
        if (r.right <= 0 || r.left >= innerWidth) continue;
        return true;
      }
      return false;
    }, text);
    if (found) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`text not visible: ${text}`);
}

async function clickByText(page, selector, text) {
  const ok = await page.evaluate(
    (sel, t) => {
      const els = [...document.querySelectorAll(sel)];
      const el = els.find((e) => e.textContent.toLowerCase().includes(t.toLowerCase()));
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    text
  );
  if (!ok) throw new Error(`no ${selector} with text ${text}`);
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  args: ["--enable-unsafe-swiftshader", "--disable-gpu-sandbox", "--no-sandbox", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});

const consoleErrors = [];
const external = [];
const pageOrigin = new URL(PAGE_URL).origin;
/** Watch every page, not just the first: the reduced-motion and mobile runs
 *  previously reported nothing at all. */
function watch(p) {
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  p.on("pageerror", (e) => consoleErrors.push(String(e)));
  p.on("requestfailed", (r) => {
    const u = r.url();
    if (!u.includes("og.png")) consoleErrors.push(`request failed: ${u}`);
  });
  p.on("request", (r) => {
    const u = r.url();
    if (u.startsWith("data:") || u.startsWith("blob:")) return;
    try {
      // the page's own origin is not an external call
      if (new URL(u).origin !== pageOrigin) external.push(u);
    } catch {
      /* unparseable URL: let requestfailed report it */
    }
  });
}
try {
  const page = await browser.newPage();
  watch(page);

  await page.goto(PAGE_URL, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("h1", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  await check("01 title", async () => {
    const t = await page.title();
    if (!t.includes("Quillpad")) throw new Error(`title: ${t}`);
  });

  await check("02 hero h1", async () => {
    const h1 = await page.$eval("h1", (e) => e.textContent);
    if (!/chapter/i.test(h1)) throw new Error(`h1: ${h1}`);
  });

  await check("03 CTA above fold", async () => {
    const box = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/download/Quillpad.exe"][download]');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { y: r.y, h: r.height };
    });
    if (!box) throw new Error("download CTA not found");
    if (box.y + box.h / 2 > 900) throw new Error(`CTA at y ${box.y}`);
  });

  await check("04 nav", async () => {
    const has = await page.evaluate(() => {
      const links = [...document.querySelectorAll("header a")];
      return links.some((l) => l.textContent.includes("Get the app"));
    });
    if (!has) throw new Error("Get the app link missing");
  });

  await check("05 canvas animated + inked", async () => {
    const canvas = await page.$("canvas");
    if (!canvas) throw new Error("no canvas");
    const shot1 = await canvas.screenshot({ encoding: "base64" });
    await new Promise((r) => setTimeout(r, 700));
    const shot2 = await canvas.screenshot({ encoding: "base64" });
    if (shot1 === shot2) throw new Error("canvas static across 700ms");
    const inked = await page.evaluate(() => {
      const c = document.querySelector("#hero canvas");
      const x = c.getContext("2d");
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 12) n++;
      return n;
    });
    if (inked < 400)
      throw new Error(`trail not drawing: ${inked} inked pixels`);
  });

  await check("05b trails keep drawing", async () => {
    const inked = async () =>
      page.evaluate(() => {
        const c = document.querySelector("#hero canvas");
        const x = c.getContext("2d");
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 12) n++;
        return n;
      });
    const a = await inked();
    await new Promise((r) => setTimeout(r, 1600));
    const b = await inked();
    if (a === b) throw new Error(`trails frozen at ${a} pixels`);
    if (b < 400) throw new Error(`trails too faint: ${b} pixels`);
  });

  await check("06 progress bar exists", async () => {
    // scope to the hairline: `header .bg-rust` also matched the CTA button
    const has = await page.evaluate(
      () => !!document.querySelector("header .origin-left.bg-rust")
    );
    if (!has) throw new Error("scroll progress hairline missing");
  });

  await check("07 transform pinned", async () => {
    const info = await page.evaluate(() => {
      const el = document.getElementById("transform");
      if (!el) return null;
      const h = el.getBoundingClientRect().height;
      const sticky = [...el.querySelectorAll("*")].some(
        (c) => getComputedStyle(c).position === "sticky"
      );
      return { h, sticky };
    });
    if (!info) throw new Error("#transform missing");
    if (info.h < 3 * 900) throw new Error(`section height ${info.h}`);
    // height alone proves nothing — the sequence must actually pin
    if (!info.sticky) throw new Error("no sticky child: sequence is not pinned");
  });

  await check("08 note assembles", async () => {
    await page.evaluate(() => {
      const el = document.querySelector("#transform");
      el.scrollIntoView();
    });
    await page.evaluate(() => window.scrollBy(0, 2 * 900));
    await new Promise((r) => setTimeout(r, 600));
    await textVisible(page, "Cell Structure & Function");
  });

  await check("09 flashcard flip", async () => {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#study").scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 400));
    // click the card that is actually interactive (the top one), and assert
    // ITS answer becomes visible — the old check matched a background card's
    // always-mounted back face, so it passed without a flip ever happening
    const answer = await page.evaluate(() => {
      const top = document.querySelector('#study button[tabindex="0"]');
      if (!top) return null;
      top.scrollIntoView({ block: "center" });
      const back = top.querySelector(".sheet-deep p");
      return back?.textContent?.trim().slice(0, 40) || null;
    });
    if (!answer) throw new Error("no answer face on the top card");
    await page.click('#study button[tabindex="0"]');
    await new Promise((r) => setTimeout(r, 700));
    await textVisible(page, answer, 3000);
  });

  await check("10 quiz marks a wrong pick", async () => {
    // Ribosome is the correct answer, so pick Nucleus and require the
    // wrong-answer treatment: status says so, the pick is crossed out, and
    // the teacher still circles the right answer
    await clickByText(page, "#study button", "Nucleus");
    const state = await page.evaluate(() => ({
      status: document.querySelector('#exam-paper [role="status"]')?.textContent ?? "",
      crossed: !!document.querySelector("#study svg path[d^='M 3 3 L 17 17']"),
      circled: !!document.querySelector("#study filter#qpPen"),
    }));
    if (state.status.trim() !== "Not quite")
      throw new Error(`status was "${state.status}"`);
    if (!state.crossed) throw new Error("wrong pick not crossed out");
    if (!state.circled) throw new Error("correct answer not circled");
  });

  await check("11 quiz keyboard", async () => {
    await clickByText(page, "#study button", "try again");
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => {
      const el = document.querySelector("#exam-paper");
      if (!el) throw new Error("exam paper missing");
      el.scrollIntoView({ block: "center" });
      el.focus();
    });
    // Digit2 = the second option = the correct one
    await page.keyboard.press("Digit2");
    const state = await page.evaluate(() => ({
      status: document.querySelector('#exam-paper [role="status"]')?.textContent ?? "",
      circled: !!document.querySelector("#study filter#qpPen"),
    }));
    if (state.status.trim() !== "Correct")
      throw new Error(`keyboard answer status was "${state.status}"`);
    if (!state.circled) throw new Error("keyboard-picked correct answer not circled");
  });

  await check("12 ask search", async () => {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#ask-demo").scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 300));
    const input = await page.$('input[placeholder*="ask anything"]');
    if (!input) throw new Error("ask input missing");
    await input.click();
    await input.type("periodic trends");
    await new Promise((r) => setTimeout(r, 600));
    // the matching chapter itself, not the .sr-only sidebar narration that
    // mentions Chemistry too
    await textVisible(page, "Periodic Trends", 3000);
  });

  await check("13 ask empty state", async () => {
    // clear through the native setter: React's value tracker ignores a plain
    // `el.value = ""`, which left the results filtering instead of resetting
    await page.evaluate(() => {
      const i = document.querySelector('input[placeholder*="ask anything"]');
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      setter.call(i, "");
      i.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 500));
    const chip = await page.evaluate(() =>
      [...document.querySelectorAll("#ask-demo button")].some(
        (b) => b.getBoundingClientRect().height > 0
      )
    );
    if (!chip) throw new Error("suggestion chips missing");
  });

  await check("14 sidebar shows real filenames", async () => {
    await page.evaluate(() => document.querySelector("#yours").scrollIntoView());
    // the filename the app actually writes, and it must be the visible one
    // (not the .sr-only narration, which the old oracle accepted)
    await textVisible(page, "04-cell-structure-function.md", 3000);
    const listed = await page.evaluate(() => {
      const el = [...document.querySelectorAll("#yours *")].find(
        (n) =>
          n.children.length === 0 &&
          n.textContent.includes("04-cell-structure-function.md")
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!listed) throw new Error("note filename not rendered in the sidebar");
  });

  await check("15 download facts", async () => {
    if (!sha) throw new Error("sha256 not parsed from download-info.ts");
    const body = await page.evaluate(() => document.body.textContent);
    if (!body.includes(sha)) throw new Error("sha not shown");
    // derive the expected label from the artifact instead of hardcoding a size
    const mib = (size / 1024 / 1024).toFixed(1);
    if (!body.includes(`${mib} MB`))
      throw new Error(`size not shown (expected ${mib} MB)`);
    const stat = fs.statSync(exePath);
    if (stat.size !== size) throw new Error(`exe ${stat.size} != stamped ${size}`);
  });

  await check("16 checksum copy", async () => {
    await page.evaluate(() => document.querySelector("#download").scrollIntoView());
    await new Promise((r) => setTimeout(r, 300));
    // This host denies clipboard writes to automation, so instrument the API
    // instead: the check then proves the app passes the real sha and reflects
    // success, which reading the OS clipboard could not do here anyway.
    const out = await page.evaluate(async (expected) => {
      const seen = [];
      const real = navigator.clipboard;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (t) => void seen.push(t) },
      });
      const btn = [...document.querySelectorAll("#download button")].find(
        (b) => b.textContent.trim() === "copy"
      );
      if (!btn) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: real,
        });
        return { error: "copy button not found" };
      }
      btn.click();
      await new Promise((r) => setTimeout(r, 400));
      const label = [...document.querySelectorAll("#download button")].map((b) =>
        b.textContent.trim()
      );
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: real,
      });
      return { seen, label };
    }, sha);
    if (out.error) throw new Error(out.error);
    if (out.seen.length !== 1)
      throw new Error(`writeText called ${out.seen.length} times`);
    if (out.seen[0] !== sha)
      throw new Error(`copied the wrong value: ${String(out.seen[0]).slice(0, 16)}…`);
    if (!out.label.includes("copied"))
      throw new Error(`label did not confirm: ${out.label.join(",")}`);
  });

  await check("17 reduced motion", async () => {
    const rm = await browser.newPage();
    watch(rm);
    await rm.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await rm.goto(PAGE_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await rm.waitForSelector("h1", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    const h1 = await rm.$eval("h1", (e) => {
      const r = e.getBoundingClientRect();
      return r.height > 0;
    });
    if (!h1) throw new Error("h1 not visible under reduced motion");
    const overflow = await rm.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    if (overflow) throw new Error("horizontal overflow under reduced motion");
    await rm.close();
  });

  await check("18 mobile overflow", async () => {
    const m = await browser.newPage();
    watch(m);
    await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.goto(PAGE_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const overflow = await m.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    if (overflow) throw new Error("horizontal overflow at 390px");
    const cta = await m.evaluate(() => {
      const a = document.querySelector('a[href*="/download/Quillpad.exe"]');
      return !!a;
    });
    if (!cta) throw new Error("download CTA missing on mobile");
    await m.close();
  });

  await check("19 external requests", async () => {
    if (external.length) throw new Error(`external: ${external.slice(0, 3).join(", ")}`);
  });

  await check("20 console clean", async () => {
    if (consoleErrors.length)
      throw new Error(`${consoleErrors.length} console errors: ${consoleErrors[0]}`);
  });

  await check("21 raw/rendered toggle", async () => {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#yours").scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 600));
    const found = await page.evaluate(() => {
      const bs = [...document.querySelectorAll("#yours button[aria-pressed]")];
      return bs.map((b) => b.textContent);
    });
    if (!found.includes("raw") || !found.includes("rendered"))
      throw new Error(`aria-pressed buttons: ${JSON.stringify(found)}`);
    const rawShown = await page.evaluate(() =>
      !!document.querySelector("#yours pre")
    );
    if (!rawShown) throw new Error("raw pre not shown by default");
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("#yours button[aria-pressed]")]
        .find((x) => x.textContent === "rendered");
      b.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const rendered = await page.evaluate(() => {
      const pre = document.querySelector("#yours pre");
      const note = [...document.querySelectorAll("#yours h3")].some((h) =>
        h.textContent.includes("Cell Structure")
      );
      return !pre && note;
    });
    if (!rendered) throw new Error("rendered view did not swap in");
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("#yours button[aria-pressed]")]
        .find((x) => x.textContent === "raw");
      b.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const back = await page.evaluate(() => !!document.querySelector("#yours pre"));
    if (!back) throw new Error("did not return to raw");
  });

  await check("22 midnight engine band", async () => {
    const bg = await page.evaluate(() => {
      const el = document.getElementById("engine");
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    if (bg !== "rgb(36, 27, 18)") throw new Error(`engine bg is ${bg}`);
    const inks = await page.evaluate(() => {
      const el = document.getElementById("engine");
      const h = el.querySelector("h2");
      return getComputedStyle(h).color;
    });
    if (inks !== "rgb(233, 220, 196)")
      throw new Error(`engine heading color ${inks}`);
  });

  await check("23 index tab rail", async () => {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 1500);
    });
    await new Promise((r) => setTimeout(r, 300));
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll(".tab")].filter(
        (t) => t.getBoundingClientRect().width > 0
      ).length
    );
    if (tabs < 6) throw new Error(`visible tabs: ${tabs}`);
    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => {
      const get = document.querySelector('.tab[href="#download"]');
      if (!get) throw new Error("download tab missing");
      get.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const after = await page.evaluate(() => window.scrollY);
    if (after <= before)
      throw new Error(`no scroll: ${Math.round(before)} -> ${Math.round(after)}`);
    // the tab that was clicked must be the one marked current
    const currentTab = await page.evaluate(() => {
      const active = document.querySelector(".tab.active");
      return active ? active.getAttribute("href") : null;
    });
    if (currentTab !== "#download")
      throw new Error(`active tab is ${currentTab}, expected #download`);
  });

  await check("23b tab rail clears when no plate is in view", async () => {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 500));
    const stale = await page.evaluate(() => !!document.querySelector(".tab.active"));
    if (stale) throw new Error("a tab stayed active with no plate in view");
  });

  await check("24 computed contrast budget", async () => {
    const fails = await page.evaluate(() => {
      const parse = (s) => {
        const m = s.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
      };
      const lum = ([r, g, b]) => {
        const f = (c) => {
          c /= 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgOf = (el) => {
        let e = el;
        while (e) {
          const c = parse(getComputedStyle(e).backgroundColor);
          if (c && c[3] > 0.92) return c;
          e = e.parentElement;
        }
        return [243, 234, 218];
      };
      const out = [];
      const els = document.querySelectorAll(
        "h1,h2,h3,p,a,button,li,label,input,pre,footer *"
      );
      for (const el of els) {
        const text = el.textContent?.trim();
        if (!text || el.closest("[aria-hidden]")) continue;
        const cs = getComputedStyle(el);
        const fg = parse(cs.color);
        if (!fg) continue;
        const bg = bgOf(el);
        const l1 = lum(fg);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
        if (ratio < (large ? 3 : 4.5))
          out.push({ text: text.slice(0, 30), size, ratio: ratio.toFixed(2) });
      }
      return out;
    });
    if (fails.length)
      throw new Error(`${fails.length} fails: ${JSON.stringify(fails[0])}`);
  });

  await check("25 font budget (3 families, <=3 weights)", async () => {
    const r = await page.evaluate(() => {
      const fams = new Set();
      const wts = new Set();
      document
        .querySelectorAll("h1,h2,h3,p,a,button,li,span,label,pre")
        .forEach((el) => {
          if (!el.textContent.trim()) return;
          const cs = getComputedStyle(el);
          fams.add(cs.fontFamily.split(",")[0].replace(/["']/g, "").trim());
          wts.add(cs.fontWeight);
        });
      return { fams: [...fams], wts: [...wts] };
    });
    if (r.fams.length !== 3)
      throw new Error(`families ${r.fams.length}: ${r.fams.join(",")}`);
    const extra = r.wts.filter(
      (w) => !["400", "500", "600"].includes(w)
    );
    if (extra.length) throw new Error(`extra weights: ${extra.join(",")}`);
  });

  await check("26 composited text contrast on hero art", async () => {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const style = document.createElement("style");
      style.id = "qp-px-test";
      style.textContent =
        "#top h1, #top h1 *, #top p.text-lg, #top .kicker, #top p.text-sm { visibility: hidden !important; }";
      document.head.appendChild(style);
    });
    await new Promise((r) => setTimeout(r, 900));
    const boxes = await page.evaluate(() => {
      const pick = (el) => {
        const r = el.getBoundingClientRect();
        return {
          x: Math.max(0, Math.round(r.x)),
          y: Math.max(0, Math.round(r.y)),
          width: Math.round(r.width),
          height: Math.round(Math.min(r.height, innerHeight - r.y)),
        };
      };
      return {
        h1: pick(document.querySelector("h1")),
        lead: pick(document.querySelector("#top p.text-lg")),
      };
    });
    const shots = {
      h1: await page.screenshot({ encoding: "base64", clip: boxes.h1 }),
      lead: await page.screenshot({ encoding: "base64", clip: boxes.lead }),
    };
    await page.evaluate(() =>
      document.getElementById("qp-px-test")?.remove()
    );
    const res = await page.evaluate(async (imgs) => {
      const lum = (r, g, b) => {
        const f = (c) => {
          c /= 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const out = {};
      for (const [key, b64] of Object.entries(imgs)) {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let minBg = 1;
        for (let i = 0; i < d.length; i += 4) {
          const L = lum(d[i], d[i + 1], d[i + 2]);
          if (L < minBg) minBg = L;
        }
        out[key] = {
          vsInk: (minBg + 0.05) / (0.0239 + 0.05),
          vsInkSoft: (minBg + 0.05) / (0.0851 + 0.05),
          vsRust: (minBg + 0.05) / (0.1824 + 0.05),
        };
      }
      return out;
    }, shots);
    // h1 holds ink body + large rust accent word (>=3:1 large-text rule);
    // the lead paragraph holds ink-soft. Divide rust by its own threshold.
    const worst = Math.min(
      res.h1.vsInk,
      res.h1.vsRust * 1.5,
      res.lead.vsInk,
      res.lead.vsInkSoft
    );
    if (worst < 4.5)
      throw new Error(`composited contrast ${worst.toFixed(2)} < 4.5: ${JSON.stringify(res)}`);
  });

  await check("27 version agrees across sources", async () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    const stamped = dlSrc.match(/version:\s*"([^"]+)"/)?.[1];
    if (!stamped) throw new Error("no version in download-info.ts");
    if (pkg.version !== stamped)
      throw new Error(`package ${pkg.version} vs stamped ${stamped}`);
    const shown = await page.evaluate(() => document.body.textContent);
    if (!shown.includes(stamped)) throw new Error(`version ${stamped} not shown`);
  });

  await check("28 og image serves", async () => {
    const res = await fetch(new URL("/og.png", PAGE_URL));
    if (!res.ok) throw new Error(`/og.png -> ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) throw new Error(`og.png is ${type}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 10000) throw new Error(`og.png is ${bytes.length} bytes`);
    // the public copy is what gets served; it must match what was built
    const onDisk = fs.readFileSync(path.join(root, "public", "og.png"));
    if (!onDisk.equals(bytes))
      throw new Error("served og.png differs from public/og.png (stale build)");
  });

  await check("29 every section has a resolvable name", async () => {
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll("section[aria-labelledby]")]
        .map((s) => s.getAttribute("aria-labelledby"))
        .filter((id) => !id || !document.getElementById(id))
    );
    if (broken.length)
      throw new Error(`aria-labelledby with no target: ${broken.join(", ")}`);
  });

  await check("30 no mojibake in visible text", async () => {
    const bad = await page.evaluate(() => {
      const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (/[\uFFFD]/.test(n.textContent) && n.textContent.trim())
          out.push(n.textContent.trim().slice(0, 40));
      }
      return out;
    });
    if (bad.length) throw new Error(`replacement chars: ${bad.join(" | ")}`);
  });
} finally {
  await browser.close();
}

for (const r of results) console.log(r);
console.log(`${results.length - failures}/${results.length} passed`);
process.exit(failures > 0 ? failures : 0);
