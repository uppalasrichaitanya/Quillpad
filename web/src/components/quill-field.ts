/**
 * Quill Trail: slow ink flourishes that draw themselves across the hero.
 *
 * A small cast of hand-composed gestures — long sweeps, cursive loop
 * flourishes, rising curls, gentle waves — each resampled with Catmull-Rom
 * so the path flows instead of kinking at control points. A stroke draws in
 * over several seconds with a pen-pressure width, rests, then fades while
 * the next one begins. The ink is feathered: a wide faint halo under a dark
 * core that pools where the hand slows.
 *
 * Canvas 2D; DPR capped at 1.5; the rAF loop pauses offscreen; reduced
 * motion gets one settled frame.
 */

export type QuillFieldHandle = { dispose: () => void };

type Pt = { x: number; y: number; w: number };

type Stroke = {
  pts: Pt[];
  dur: number;
  hold: number;
  fade: number;
  rust: boolean;
  strength: number;
};

type Anchor = { x: number; y: number; w: number };

const INK = "54, 43, 30";
const DEEP = "33, 24, 16";
const RUST = "177, 81, 44";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function catmull(a: number, b: number, c: number, d: number, u: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * b +
      (-a + c) * u +
      (2 * a - 5 * b + 4 * c - d) * u2 +
      (-a + 3 * b - 3 * c + d) * u3)
  );
}

/** Dense Catmull-Rom path from a few hand-placed anchors. */
function resample(anchors: Anchor[], per = 10): Pt[] {
  const n = anchors.length;
  if (n < 2) return anchors.slice();
  const out: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(n - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const u = s / per;
      out.push({
        x: catmull(p0.x, p1.x, p2.x, p3.x, u),
        y: catmull(p0.y, p1.y, p2.y, p3.y, u),
        w: Math.max(0.2, catmull(p0.w, p1.w, p2.w, p3.w, u)),
      });
    }
  }
  out.push({ x: anchors[n - 1].x, y: anchors[n - 1].y, w: anchors[n - 1].w });
  return out;
}

/** Long, shallow underline that bows slightly. */
function sweep(rng: () => number): Anchor[] {
  const len = 160 + rng() * 150;
  const bow = (rng() - 0.5) * 70;
  return [
    { x: 0, y: 0, w: 0.3 },
    { x: len * 0.22, y: bow * 0.2, w: 1.3 },
    { x: len * 0.52, y: bow * 0.62, w: 2.4 },
    { x: len * 0.8, y: bow, w: 1.4 },
    { x: len, y: bow * 0.94, w: 0.25 },
  ];
}

/** Cursive loop flourish: one or two loops and a tail. */
function flourish(rng: () => number): Anchor[] {
  const r = 10 + rng() * 7;
  const loops = 1 + Math.floor(rng() * 2);
  const pts: Anchor[] = [{ x: 0, y: 0, w: 0.3 }];
  let x = 0;
  let y = 0;
  for (let i = 0; i < loops; i++) {
    pts.push({ x: x + r * 0.5, y: y - r * 0.6, w: 1.1 });
    pts.push({ x: x + r * 0.7, y: y - r * 1.7, w: 1.5 });
    pts.push({ x: x + r * 1.7, y: y - r * 1.9, w: 1.0 });
    pts.push({ x: x + r * 2.1, y: y - r * 0.7, w: 1.9 });
    pts.push({ x: x + r * 1.1, y: y + r * 0.3, w: 2.2 });
    pts.push({ x: x + r * 0.2, y: y - r * 0.3, w: 1.5 });
    x += r * 2.1;
    y += (rng() - 0.5) * 5;
  }
  pts.push({ x: x + 18, y: y - 11, w: 1.0 });
  pts.push({ x: x + 38, y: y - 2, w: 0.25 });
  return pts;
}

/** Rising arc that curls over at the top. */
function risingCurl(rng: () => number): Anchor[] {
  const s = 0.95 + rng() * 0.5;
  return [
    { x: 0, y: 0, w: 0.3 },
    { x: 30 * s, y: -10 * s, w: 1.2 },
    { x: 68 * s, y: -34 * s, w: 1.6 },
    { x: 104 * s, y: -62 * s, w: 2.1 },
    { x: 124 * s, y: -76 * s, w: 1.6 },
    { x: 130 * s, y: -86 * s, w: 1.1 },
    { x: 122 * s, y: -92 * s, w: 1.3 },
    { x: 112 * s, y: -87 * s, w: 1.7 },
    { x: 116 * s, y: -77 * s, w: 1.0 },
    { x: 126 * s, y: -79 * s, w: 0.3 },
  ];
}

/** Gentle wave run, thickening in the troughs. */
function wave(rng: () => number): Anchor[] {
  const amp = 8 + rng() * 9;
  const wl = 34 + rng() * 16;
  const n = 5 + Math.floor(rng() * 2);
  const pts: Anchor[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({
      x: t * wl * n,
      y: Math.sin(t * Math.PI * 2) * amp * (0.65 + t * 0.45),
      w: 0.35 + Math.abs(Math.cos(t * Math.PI * 2)) * 1.7,
    });
  }
  pts[0].w = 0.3;
  pts[n].w = 0.25;
  return pts;
}

const GESTURES = [sweep, flourish, risingCurl, wave];

/** Is this point clear of the reading text? Tested against a snapshot of the
 *  measured zones, so a placement pass never re-reads layout per point. */
function quietAt(
  zones: { x: number; y: number; w: number; h: number }[],
  x: number,
  y: number,
): boolean {
  for (const q of zones) {
    if (x > q.x - 24 && x < q.x + q.w + 24 && y > q.y - 18 && y < q.y + q.h + 18) {
      return false;
    }
  }
  return true;
}

/** Compose one gesture, place it on quiet paper, and return its ink path. */
function generateStroke(
  W: number,
  H: number,
  rng: () => number,
  quiet: (x: number, y: number) => boolean,
  zone: () => { x: number; y: number; w: number; h: number }[]
): Pt[] | null {
  // free rectangles: above all zones, below them, and flanking each one
  const qs = zone();
  const rects: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const sorted = qs.slice().sort((a, b) => a.x - b.x);
  for (const q of sorted) {
    const y0 = Math.max(18, q.y - 8);
    const y1 = Math.min(H - 24, q.y + q.h + 8);
    const xL = q.x - 42;
    const xR = q.x + q.w + 42;
    if (xL - 14 > 110 && y1 - y0 > 40) rects.push({ x0: 14, y0, x1: xL, y1 });
    if (W - 18 - xR > 110 && y1 - y0 > 40) rects.push({ x0: xR, y0, x1: W - 18, y1 });
  }
  if (sorted.length) {
    const topMost = Math.min(...sorted.map((q) => q.y));
    if (topMost - 26 > 100)
      rects.push({ x0: 14, y0: 26, x1: W - 18, y1: topMost - 10 });
    const bottomMost = Math.max(...sorted.map((q) => q.y + q.h));
    if (H - bottomMost - 30 > 100)
      rects.push({ x0: 14, y0: bottomMost + 12, x1: W - 18, y1: H - 26 });
  }
  if (!rects.length) rects.push({ x0: 14, y0: 26, x1: W - 18, y1: H - 26 });

  const gesture = GESTURES[Math.floor(rng() * GESTURES.length)];
  const anchors = gesture(rng);

  const flip = rng() < 0.5 ? -1 : 1;
  const rot = (rng() - 0.5) * 0.3;
  const scale = 0.72 + rng() * 0.5;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const local: Pt[] = anchors.map((a) => {
    const x = a.x * scale;
    const y = a.y * scale * flip;
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
    return { x: rx, y: ry, w: a.w * scale };
  });
  const gw = maxX - minX;
  const gh = maxY - minY;

  for (let tries = 0; tries < 140; tries++) {
    const rect = rects[Math.floor(rng() * rects.length)];
    const rw = rect.x1 - rect.x0;
    const rh = rect.y1 - rect.y0;
    if (rw < gw + 8 || rh < gh + 8) continue;
    const tx = rect.x0 + rng() * (rw - gw) - minX;
    const ty = rect.y0 + rng() * (rh - gh) - minY;
    const cand: Pt[] = local.map((p) => ({ x: p.x + tx, y: p.y + ty, w: p.w }));
    const dense = resample(cand, 10);
    const pts: Pt[] = [];
    for (const p of dense) {
      if (p.x < 6 || p.x > W - 6 || p.y < 6 || p.y > H - 6) break;
      if (!quiet(p.x, p.y)) break;
      pts.push(p);
    }
    if (pts.length >= Math.max(24, Math.floor(dense.length * 0.55))) {
      return pts;
    }
  }
  return null;
}

export function createQuillField(
  canvas: HTMLCanvasElement,
  quietZones: () => { x: number; y: number; w: number; h: number }[]
): QuillFieldHandle {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("no 2d context");
  // non-null alias: the frame callbacks below close over this
  const ctx: CanvasRenderingContext2D = context;

  let W = 0;
  let H = 0;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    const w = Math.max(1, Math.floor(W * dpr));
    const h = Math.max(1, Math.floor(H * dpr));
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w;
    canvas.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  };
  resize();

  const rng = mulberry32((Date.now() & 0xffff) ^ 0x9e37);
  const strokes = new Map<number, Stroke>();
  let nextId = 0;
  let nextSpawnAt = 0;
  const SPAWN_MIN = 3.2;
  const SPAWN_JIT = 1.6;
  const MAX_ALIVE = 4;

  function spawn() {
    if (strokes.size >= MAX_ALIVE) return;
    if (W < 60 || H < 60) return;
    // one layout read per spawn: measuring the zones per sampled point forced
    // a reflow for every point of every placement attempt
    const zones = quietZones();
    const pts = generateStroke(
      W,
      H,
      rng,
      (x, y) => quietAt(zones, x, y),
      () => zones,
    );
    if (!pts || pts.length < 8) return;
    const faint = rng() < 0.25;
    strokes.set(nextId++, {
      pts,
      dur: 3.5 + rng() * 1.5,
      hold: 2.4 + rng() * 1.6,
      fade: 2 + rng() * 0.5,
      rust: !faint && rng() < 0.25,
      strength: faint ? 0.5 + rng() * 0.15 : 0.75 + rng() * 0.25,
    });
  }

  const stamp = (x: number, y: number, r: number, a: number, col: string) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const renderPath = (
    pts: Pt[],
    n: number,
    alpha: number,
    rust: boolean,
    strength: number
  ) => {
    const core = rust ? `rgb(${RUST})` : `rgb(${DEEP})`;
    const halo = rust ? `rgb(${RUST})` : `rgb(${INK})`;
    for (let i = 1; i < n; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const steps = Math.max(1, Math.floor(dist / 1.4));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const sx = p0.x + (p1.x - p0.x) * u;
        const sy = p0.y + (p1.y - p0.y) * u;
        const raw = p0.w + (p1.w - p0.w) * u;
        const sw = raw * 0.5;
        stamp(sx, sy, sw * 1.8 + 0.8, alpha * (rust ? 0.1 : 0.13) * strength, halo);
        stamp(sx, sy, sw, alpha * (rust ? 0.62 : 0.84) * strength, core);
        if (raw > 1.9) stamp(sx, sy, sw * 0.55, alpha * 0.2 * strength, core);
      }
    }
  };

  function drawStroke(s: Stroke, now: number, bornAt: number) {
    const end = bornAt + s.dur;
    let drawn: number;
    if (now < end) {
      drawn = (now - bornAt) / s.dur;
      drawn = 1 - Math.pow(1 - drawn, 3);
    } else drawn = 1;
    const holdEnd = end + s.hold;
    let alpha = 1;
    if (now > holdEnd) alpha = Math.max(0, 1 - (now - holdEnd) / s.fade);
    const n = Math.max(2, Math.floor(s.pts.length * drawn));
    renderPath(s.pts, n, alpha, s.rust, s.strength);

    if (now < end && n > 1) {
      const tip = s.pts[n - 1];
      const pulse = 1 + 0.3 * Math.sin(now * 4.2 + s.dur);
      const nib = `rgb(${RUST})`;
      stamp(tip.x, tip.y, 5.2 * pulse, 0.1, nib);
      stamp(tip.x, tip.y, 1.5 * pulse, 0.7, nib);
    }
    return now > holdEnd + s.fade;
  }

  let visible = true;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      // stop scheduling frames while the hero is off-screen, and pick the
      // clock up where it left off when it returns
      if (visible && !raf) {
        nextSpawnAt = 0;
        raf = requestAnimationFrame(frame);
      } else if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { threshold: 0 }
  );
  io.observe(canvas);

  const born = new Map<number, number>();
  let raf = 0;
  function frame(tms: number) {
    raf = 0;
    const now = tms / 1000;
    if (!visible) return; // observer restarts the loop when it returns
    if (now >= nextSpawnAt) {
      spawn();
      nextSpawnAt = now + (nextSpawnAt === 0 ? 0.4 : SPAWN_MIN + rng() * SPAWN_JIT);
    }
    ctx.clearRect(0, 0, W, H);
    const done: number[] = [];
    for (const [id, s] of strokes) {
      if (!born.has(id)) born.set(id, now);
      if (drawStroke(s, now, born.get(id)!)) done.push(id);
    }
    done.forEach((id) => {
      strokes.delete(id);
      born.delete(id);
    });
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  const onResize = () => {
    if (resize()) {
      strokes.clear();
      born.clear();
      // draw the first stroke right away instead of idling for a spawn interval
      nextSpawnAt = 0;
    }
  };
  window.addEventListener("resize", onResize, { passive: true });
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(onResize);
    ro.observe(canvas);
  }

  return {
    dispose: () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      strokes.clear();
      born.clear();
    },
  };
}