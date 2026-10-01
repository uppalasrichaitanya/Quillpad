// Quillpad diagram renderer — typed diagram specs in, hand-drawn-style SVG out.
// Style rules from PLAN.md §5:
//   - line art, sepia/ink-brown strokes on --paper-deep panels
//   - slightly irregular lines via SVG turbulence filter
//   - labels via dashed leader lines in the handwriting font
//   - monospace caption below, lab-notebook figure style
//   - rust accent reserved for emphasis (arrows, the highlighted part)

// Theme palette: swapped at runtime for Midnight Ink; export builders pin
// the light palette so printed/PDF notes stay cream-paper.
let INK = '#362B1E';
let INK_SOFT = '#6C5D49';
let RUST = '#BC5A32';
// tint fills that sit INSIDE shapes (must stay readable under current ink)
let TINT_ACCENT = '#F3DFD0'; // light: warm rust tint
let TINT_ALT = '#E7DCC8';    // light: alternating strip bands

export function setDiagramTheme({ ink, inkSoft, rust, tintAccent, tintAlt } = {}) {
  INK = ink || '#362B1E';
  INK_SOFT = inkSoft || '#6C5D49';
  RUST = rust || '#BC5A32';
  TINT_ACCENT = tintAccent || '#F3DFD0';
  TINT_ALT = tintAlt || '#E7DCC8';
}

let filterSeq = 0;

function roughFilter() {
  // unique id per render so multiple diagrams don't share filter state
  const id = `qpRough${++filterSeq}`;
  return {
    id,
    def: `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter>`,
  };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------------- labelled blob (e.g. generalised cell) ---------------- */

function renderLabelledBlob(d) {
  const f = roughFilter();
  const parts = (d.parts || []).filter((p) => p && p.label);
  const innerParts = parts.filter((p) => p.kind !== 'edge');
  const edgeParts = parts.filter((p) => p.kind === 'edge');

  // label slots: alternate sides; height grows with slot count
  const leftCount = Math.ceil(innerParts.length / 2);
  const rightCount = innerParts.length - leftCount;
  const slotGap = 62;
  const H = Math.max(300, 70 + Math.max(leftCount, rightCount, 1) * slotGap + 40);
  const W = 640;
  const cx = W / 2, cy = H / 2 + 10;
  const blobRx = 250, blobRy = Math.min(120, cy - 30);

  let inner = `
    <ellipse cx="${cx}" cy="${cy}" rx="${blobRx}" ry="${blobRy}" fill="none" stroke="${INK}" stroke-width="2" filter="url(#${f.id})"/>
  `;

  // inner parts sit on a ring around the blob's centre
  innerParts.forEach((p, i) => {
    const n = innerParts.length;
    // golden-angle spacing keeps 3-6 parts visually balanced
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(3, n);
    const px = cx + Math.cos(ang) * (blobRx * 0.42);
    const py = cy + Math.sin(ang) * (blobRy * 0.45);
    const stroke = p.accent ? RUST : INK;

    if (p.kind === 'oval') {
      const rx = p.size === 'large' ? 52 : p.size === 'small' ? 26 : 38;
      const ry = rx * 0.8;
      inner += `<ellipse cx="${px}" cy="${py}" rx="${rx}" ry="${ry}" fill="none" stroke="${stroke}" stroke-width="2" filter="url(#${f.id})"/>`;
      if (p.accent) {
        inner += `<circle cx="${px}" cy="${py}" r="9" fill="${RUST}" opacity="0.5"/>`;
      }
    } else if (p.kind === 'dot') {
      const count = Math.max(1, p.count || 1);
      for (let k = 0; k < count; k++) {
        const ox = px + (k % 3) * 15 - 15;
        const oy = py + Math.floor(k / 3) * 10;
        inner += `<circle cx="${ox}" cy="${oy}" r="3.5" fill="${stroke}"/>`;
      }
    } else if (p.kind === 'squiggle') {
      inner += `<path d="M ${px - 30} ${py} q 40 -8 60 10" fill="none" stroke="${INK_SOFT}" stroke-width="1.4" filter="url(#${f.id})"/>`;
    }

    // leader line to its side label slot
    const goLeft = i % 2 === 0;
    const slot = goLeft ? Math.floor(i / 2) : Math.floor((i - 1) / 2);
    const lx = goLeft ? 150 : W - 150;
    const ly = 70 + slot * slotGap;
    inner += `
      <line x1="${px}" y1="${py}" x2="${lx}" y2="${ly}" stroke="${INK_SOFT}" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${goLeft ? lx - 10 : lx + 10}" y="${ly + 5}" font-family="Caveat" font-size="20" fill="${INK}"
        text-anchor="${goLeft ? 'end' : 'start'}">${esc(p.label)}</text>`;
  });

  // edge labels: leader from the blob outline itself
  edgeParts.forEach((p, i) => {
    const ly = H - 24 - i * 26;
    const bx = cx + blobRx * 0.55;
    const by = cy + blobRy * 0.83;
    inner += `
      <line x1="${bx}" y1="${by}" x2="${W - 150}" y2="${ly}" stroke="${INK_SOFT}" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${W - 140}" y="${ly + 5}" font-family="Caveat" font-size="20" fill="${INK}" text-anchor="start">${esc(p.label)}</text>`;
  });

  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(d.outline || 'diagram')}">
    <defs>${f.def}</defs>
    ${inner}
  </svg>`;
  return { svg, caption: d.caption || '' };
}

/* ---------------- trend grid (e.g. periodic table trends) ---------------- */

function renderTrendGrid(d) {
  const f = roughFilter();
  const rows = d.rows || 4, cols = d.cols || 6;
  const boxW = 46, boxH = 28, gapX = 55, gapY = 35;
  const x0 = 90, y0 = 30;
  const W = x0 + cols * gapX + 60, H = y0 + rows * gapY + 40;

  let cells = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells += `<rect x="${x0 + c * gapX}" y="${y0 + r * gapY}" width="${boxW}" height="${boxH}" fill="none"
        stroke="${INK_SOFT}" stroke-width="1" filter="url(#${f.id})" opacity="0.55"/>`;
    }
  }

  let arrows = '';
  (d.trends || []).forEach((t) => {
    const label = esc(t.label || '');
    if (t.direction === 'right') {
      const y = y0 - 10;
      arrows += `
        <path d="M ${x0 + 20} ${y} L ${x0 + cols * gapX - 30} ${y}" stroke="${RUST}" stroke-width="2" filter="url(#${f.id})" marker-end="url(#${f.id}a)"/>
        <text x="${x0 + 40}" y="${y - 6}" font-family="Caveat" font-size="20" fill="${INK}">${label} →</text>`;
    } else if (t.direction === 'up') {
      const x = x0 - 35;
      const midY = y0 + (rows * gapY) / 2;
      // rotate around the label's own anchor with middle baseline so long
      // text centers vertically instead of extending above the viewBox
      arrows += `
        <path d="M ${x} ${y0 + rows * gapY - 10} L ${x} ${y0 + 15}" stroke="${RUST}" stroke-width="2" filter="url(#${f.id})" marker-end="url(#${f.id}a)"/>
        <text x="${x - 10}" y="${midY}" font-family="Caveat" font-size="20" fill="${INK}"
          text-anchor="middle" dominant-baseline="middle"
          transform="rotate(-90 ${x - 10} ${midY})">${label} →</text>`;
    }
  });

  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(d.caption || 'trend grid')}">
      <defs>${f.def}
        <marker id="${f.id}a" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="${RUST}" stroke-width="1.5"/>
        </marker>
      </defs>
      ${cells}${arrows}
    </svg>`,
    caption: d.caption || '',
  };
}

/* ---------------- process flow (left-to-right steps) ---------------- */

function renderProcessFlow(d) {
  const f = roughFilter();
  const steps = d.steps || [];
  const boxW = 150, boxH = 68, gap = 50;
  const n = steps.length;
  const W = Math.max(640, n * (boxW + gap) + 40), H = 200;
  let inner = '';
  steps.forEach((s, i) => {
    const x = 20 + i * (boxW + gap);
    const y = 60;
    inner += `
      <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="6" fill="none" stroke="${INK}" stroke-width="2" filter="url(#${f.id})"/>
      <text x="${x + boxW / 2}" y="${y + boxH / 2 + 6}" font-family="Caveat" font-size="22" fill="${INK}" text-anchor="middle">${esc(s.label)}</text>`;
    if (s.note) {
      inner += `<text x="${x + boxW / 2}" y="${y + boxH + 26}" font-family="Caveat" font-size="17" fill="${INK_SOFT}" text-anchor="middle">${esc(s.note)}</text>`;
    }
    if (i < n - 1) {
      // wavy hand-drawn arrow between steps
      const ay = y + boxH / 2;
      const x1 = x + boxW + 6;
      const x2 = x + boxW + gap - 8;
      const mx = (x1 + x2) / 2;
      inner += `
        <path d="M ${x1} ${ay} Q ${mx} ${ay - 4}, ${mx} ${ay} T ${x2} ${ay}" stroke="${RUST}" stroke-width="2" filter="url(#${f.id})" marker-end="url(#${f.id}a)"/>`;
    }
  });
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(d.caption || 'process flow')}">
      <defs>${f.def}
        <marker id="${f.id}a" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="${RUST}" stroke-width="1.5"/>
        </marker>
      </defs>
      ${inner}
    </svg>`,
    caption: d.caption || '',
  };
}

/* ---------------- tree (rooted tree / forest) ---------------- */

function renderTree(d) {
  const f = roughFilter();
  const NODE_H = 34, GAP_X = 24, ROW_H = 88, FOREST_GAP = 70;
  const roots = d.trees || [];

  // node width follows its label (Caveat 21px ≈ 9px/char) so long labels
  // never overflow their box; 120px floor keeps short labels breathing
  const nodeW = (label) => Math.max(120, Math.ceil(String(label).length * 9) + 26);

  // pass 1: measure — width of a subtree is the widest row it spans
  function measure(node) {
    const w = nodeW(node.label);
    if (!node.children || !node.children.length) {
      return { w };
    }
    const kidWs = node.children.map(measure);
    const total = kidWs.reduce((a, b) => a + b.w, 0) + GAP_X * (kidWs.length - 1);
    return { w: Math.max(w, total), kidWs };
  }
  const rootMs = roots.map(measure);
  const W = Math.max(
    520,
    rootMs.reduce((a, m) => a + m.w, 0) + FOREST_GAP * (rootMs.length - 1),
  );
  const depth = (node) => 1 + (node.children?.length ? Math.max(...node.children.map(depth)) : 0);
  const maxDepth = Math.max(1, ...roots.map(depth));
  const H = 40 + maxDepth * ROW_H + 20;

  let inner = '';
  // pass 2: draw — auto-width boxes, children spread across the parent's span
  function draw(node, m, cx, y) {
    const w = nodeW(node.label);
    const x = cx - w / 2;
    const stroke = node.accent ? RUST : INK;
    inner += `<rect x="${x}" y="${y}" width="${w}" height="${NODE_H}" rx="7" fill="none"
      stroke="${stroke}" stroke-width="${node.accent ? 2.5 : 2}" filter="url(#${f.id})"/>`;
    if (node.accent) {
      inner += `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${NODE_H + 8}" rx="9"
        fill="none" stroke="${RUST}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
    }
    inner += `<text x="${cx}" y="${y + NODE_H / 2 + 6}" font-family="Caveat" font-size="21"
      fill="${INK}" text-anchor="middle">${esc(node.label)}</text>`;
    if (node.children && node.children.length) {
      const kidMs = node.children.map(measure);
      const total = kidMs.reduce((a, b) => a + b.w, 0) + GAP_X * (kidMs.length - 1);
      let kx = cx - total / 2;
      const ky = y + ROW_H - 10;
      for (let i = 0; i < node.children.length; i++) {
        const km = kidMs[i];
        const kcx = kx + km.w / 2;
        // hand-drawn curve: out of the parent, swinging into the child
        const midY = (y + NODE_H + ky) / 2;
        inner += `<path d="M ${cx} ${y + NODE_H} C ${cx} ${midY}, ${kcx} ${midY}, ${kcx} ${ky + 10}"
          fill="none" stroke="${INK_SOFT}" stroke-width="1.6" filter="url(#${f.id})"/>`;
        draw(node.children[i], km, kcx, ky + 10);
        kx += km.w + GAP_X;
      }
    }
  }

  let fx = (W - rootMs.reduce((a, m) => a + m.w, 0) - FOREST_GAP * (roots.length - 1)) / 2;
  for (let i = 0; i < roots.length; i++) {
    draw(roots[i], rootMs[i], fx + rootMs[i].w / 2, 40);
    fx += rootMs[i].w + FOREST_GAP;
  }

  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(d.caption || 'tree')}">
      <defs>${f.def}</defs>
      ${inner}
    </svg>`,
    caption: d.caption || '',
  };
}

/* ---------------- layer stack (OSI-style bands) ---------------- */

function renderLayerStack(d) {
  const f = roughFilter();
  const layers = d.layers || [];
  const BAND_H = 46, GAP_Y = 10, BAND_W = 300, BAND_X = 60, NOTE_X = BAND_X + BAND_W + 26;
  // notes sit OUTSIDE the band, to its right — never through the label.
  // canvas width grows with the longest note (Caveat 16px ≈ 7px/char).
  const noteW = (s) => Math.ceil(String(s || '').length * 7) + 12;
  const maxNote = layers.reduce((m, l) => Math.max(m, l.note ? noteW(l.note) : 0), 0);
  const W = Math.max(520, NOTE_X + maxNote);
  const H = 30 + layers.length * (BAND_H + GAP_Y) + 10;

  let inner = '';
  layers.forEach((l, i) => {
    const y = 30 + i * (BAND_H + GAP_Y);
    const stroke = l.accent ? RUST : INK_SOFT;
    const fill = l.accent ? TINT_ACCENT : 'none'; // themed tint (print-safe in light mode)
    inner += `<rect x="${BAND_X}" y="${y}" width="${BAND_W}" height="${BAND_H}" rx="6" fill="${fill}"
      stroke="${stroke}" stroke-width="${l.accent ? 2.4 : 1.6}" filter="url(#${f.id})"/>`;
    inner += `<text x="${BAND_X + BAND_W / 2}" y="${y + BAND_H / 2 + 6}" font-family="Caveat" font-size="21"
      fill="${INK}" text-anchor="middle">${esc(l.label)}</text>`;
    if (l.note) {
      inner += `<text x="${NOTE_X}" y="${y + BAND_H / 2 + 5}" font-family="Caveat" font-size="16"
        fill="${INK_SOFT}" text-anchor="start">${esc(l.note)}</text>`;
    }
  });

  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(d.caption || 'layer stack')}">
      <defs>${f.def}</defs>
      ${inner}
    </svg>`,
    caption: d.caption || '',
  };
}

/* ---------------- format strip (frame / header / spectrum) ---------------- */

function renderFormatStrip(d) {
  const f = roughFilter();
  const fields = d.fields || [];
  const W = 640, STRIP_H = 64, y0 = 56;
  const totalFlex = Math.max(1, fields.reduce((a, b) => a + (b.flex || 1), 0));
  const usable = W - 40;

  let inner = '';
  let x = 20;
  fields.forEach((fl, i) => {
    const w = (usable * (fl.flex || 1)) / totalFlex;
    const stroke = fl.accent ? RUST : INK;
    // alternate a faint tint on even segments for adjacent contrast
    // (themed fills — readable in both light and midnight modes)
    const bandFill = fl.accent
      ? TINT_ACCENT
      : i % 2 === 1
        ? TINT_ALT
        : 'none';
    inner += `<rect x="${x}" y="${y0}" width="${w}" height="${STRIP_H}" fill="${bandFill}"
      stroke="${stroke}" stroke-width="${fl.accent ? 2.2 : 1.8}" filter="url(#${f.id})"/>`;
    // label beneath, possibly split for narrow segments
    const label = String(fl.label);
    const size = label.length > 12 ? 15 : label.length > 8 ? 17 : 19;
    const cx = x + w / 2;
    if (w < 90 && label.includes(' ')) {
      const [a, ...rest] = label.split(' ');
      inner += `<text x="${cx}" y="${y0 + STRIP_H + 20}" font-family="Caveat" font-size="16" fill="${INK}" text-anchor="middle">${esc(a)}</text>`;
      inner += `<text x="${cx}" y="${y0 + STRIP_H + 36}" font-family="Caveat" font-size="16" fill="${INK}" text-anchor="middle">${esc(rest.join(' '))}</text>`;
    } else {
      inner += `<text x="${cx}" y="${y0 + STRIP_H + 22}" font-family="Caveat" font-size="${size}"
        fill="${INK}" text-anchor="middle">${esc(label)}</text>`;
    }
    x += w;
  });

  // optional trend arrow above the strip
  if (d.arrow && d.arrow.direction === 'right') {
    const y = y0 - 16;
    inner += `
      <path d="M ${30} ${y} L ${W - 40} ${y}" stroke="${RUST}" stroke-width="2" filter="url(#${f.id})" marker-end="url(#${f.id}a)"/>
      <text x="${(W + 30) / 2}" y="${y - 6}" font-family="Caveat" font-size="19" fill="${INK}"
        text-anchor="middle">${esc(d.arrow.label)} →</text>`;
  }

  const H = y0 + STRIP_H + 52;
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(d.caption || 'format strip')}">
      <defs>${f.def}
        <marker id="${f.id}a" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="${RUST}" stroke-width="1.5"/>
        </marker>
      </defs>
      ${inner}
    </svg>`,
    caption: d.caption || '',
  };
}

/* ---------------- distribution curve (bell / poisson / skewed shapes) ---------------- */

function renderDistributionCurve(d) {
  const f = roughFilter();
  // shape: normal (default) | skewed-right | skewed-left | bimodal | flat | poisson
  const shape = d.shape || 'normal';
  const W = 620, H = 270;
  const x0 = 90, y0 = 215, axisW = 440;

  function density(t) {
    switch (shape) {
      case 'skewed-right':
        return Math.exp(-6 * Math.pow(t - 0.22, 2) / (0.06 + 0.25 * t));
      case 'skewed-left':
        return Math.exp(-6 * Math.pow(t - 0.78, 2) / (0.06 + 0.25 * (1 - t)));
      case 'bimodal': {
        const a = Math.exp(-Math.pow((t - 0.32) / 0.11, 2));
        const b = Math.exp(-Math.pow((t - 0.68) / 0.11, 2));
        return Math.max(a, 0.75 * b);
      }
      case 'flat':
        return t > 0.08 && t < 0.92 ? 1 - 0.2 * Math.abs(0.5 - t) : 0.05;
      case 'poisson':
        return t < 0.06 ? 0
          : 0.95 * Math.exp(-Math.pow((t - 0.25) / 0.13, 2))
            + 0.4 * Math.exp(-Math.pow((t - 0.5) / 0.1, 2))
            + 0.2 * Math.exp(-Math.pow((t - 0.72) / 0.08, 2));
      default:
        return Math.exp(-Math.pow((t - 0.5) / 0.15, 2));
    }
  }

  const N = 60;
  let path = '';
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = x0 + t * axisW;
    const y = y0 - density(t) * 165;
    path += (i === 0 ? 'M' : 'L') + ` ${x.toFixed(1)} ${y.toFixed(1)} `;
  }

  // themed area fill: translucent version of the soft ink
  const areaFill = INK_SOFT === '#B3A184' ? 'rgba(208,116,74,0.12)' : 'rgba(108,93,73,0.10)';
  let inner = `
    <path d="${path} L ${x0 + axisW} ${y0} L ${x0} ${y0} Z" fill="${areaFill}" stroke="none"/>
    <path d="${path}" fill="none" stroke="${INK}" stroke-width="2.2" filter="url(#${f.id})"/>`;

  // centre/mean dashed line + label
  const mx = x0 + 0.5 * axisW;
  const peak = y0 - density(0.5) * 165;
  inner += `<line x1="${mx}" y1="${y0}" x2="${mx}" y2="${peak - 6}" stroke="${RUST}"
    stroke-width="1.6" stroke-dasharray="4 3"/>
    <text x="${mx}" y="${peak - 14}" font-family="Caveat" font-size="19" fill="${RUST}"
      text-anchor="middle">${esc(d.mean_label || d.meanLabel || 'mean')}</text>`;

  // x axis + ticks
  inner += `<line x1="${x0 - 14}" y1="${y0}" x2="${x0 + axisW + 14}" y2="${y0}"
    stroke="${INK}" stroke-width="1.8" filter="url(#${f.id})"/>`;
  const ticks = d.ticks || [];
  ticks.forEach((t, i) => {
    const tx = x0 + (i + 0.5) * (axisW / Math.max(1, ticks.length));
    inner += `<line x1="${tx}" y1="${y0}" x2="${tx}" y2="${y0 + 6}" stroke="${INK_SOFT}" stroke-width="1.2"/>
      <text x="${tx}" y="${y0 + 22}" font-family="IBM Plex Mono" font-size="10" fill="${INK_SOFT}"
        text-anchor="middle">${esc(t)}</text>`;
  });

  // side annotations with dashed leaders
  (d.notes || []).forEach((n, i) => {
    const side = i % 2 === 0;
    const nx = side ? 44 : x0 + axisW + 76;
    const ny = 48 + Math.floor(i / 2) * 44 + (side ? 0 : 22);
    const ax = side ? x0 + 80 : x0 + axisW - 80;
    const ay = ny + 6;
    inner += `
      <line x1="${ax}" y1="${ay}" x2="${side ? nx + 10 : nx - 10}" y2="${ny}" stroke="${INK_SOFT}"
        stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${side ? nx : nx + 0}" y="${ny + 5}" font-family="Caveat" font-size="19" fill="${INK}"
        text-anchor="${side ? 'start' : 'start'}">${esc(n)}</text>`;
  });

  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(d.caption || 'distribution')}">
      <defs>${f.def}</defs>
      ${inner}
    </svg>`,
    caption: d.caption || '',
  };
}

/* ---------------- public API ---------------- */

export function renderDiagram(spec) {
  switch (spec.type) {
    case 'labelled-blob': return renderLabelledBlob(spec.data || spec);
    case 'trend-grid': return renderTrendGrid(spec.data || spec);
    case 'process-flow': return renderProcessFlow(spec.data || spec);
    case 'tree': return renderTree(spec.data || spec);
    case 'layer-stack': return renderLayerStack(spec.data || spec);
    case 'format-strip': return renderFormatStrip(spec.data || spec);
    case 'distribution-curve': return renderDistributionCurve(spec.data || spec);
    default:
      return { svg: '', caption: '' };
  }
}

export function diagramFrame({ svg, caption }) {
  if (!svg) return '';
  return `
    <div class="diagram-wrap">
      ${svg}
      <div class="fig-caption">${esc(caption)}</div>
    </div>`;
}
