// Smoke-test the diagram renderers outside the webview: node runs the pure
// string-building logic (no DOM needed inside render* functions).
import { renderDiagram, diagramFrame } from '../src/diagrams.js';

const specs = [
  {
    type: 'labelled-blob',
    data: {
      caption: 'fig. 1.1 — generalised animal cell',
      outline: 'animal cell',
      parts: [
        { label: 'nucleus', kind: 'oval', accent: true, size: 'large' },
        { label: 'mitochondria', kind: 'oval', size: 'small' },
        { label: 'ribosomes', kind: 'dot', count: 3 },
        { label: 'rough ER', kind: 'squiggle' },
        { label: 'membrane', kind: 'edge' },
      ],
    },
  },
  {
    type: 'trend-grid',
    data: { caption: 'fig. 2.1 — trends', rows: 4, cols: 6, trends: [{ direction: 'right', label: 'increases' }, { direction: 'up', label: 'metallic character increases' }] },
  },
  {
    type: 'process-flow',
    data: { caption: 'fig. 3.1 — steps', steps: [{ label: 'a' }, { label: 'b', note: 'n' }, { label: 'c' }] },
  },
  {
    type: 'tree',
    data: {
      caption: 'fig. 4.1 — disjoint sets after union',
      trees: [
        {
          label: 'root 5', accent: true,
          children: [{ label: '4', children: [] }, { label: '7', children: [] }, { label: '9', children: [{ label: 'leaf', children: [] }] }],
        },
        { label: 'root 12', children: [{ label: '10' }, { label: '14' }] },
      ],
    },
  },
  {
    type: 'tree',
    data: {
      caption: 'fig. 4.2 — deep recursion tree',
      trees: [{
        label: 'fib(5)',
        children: [
          { label: 'fib(4)', children: [{ label: 'fib(3)', children: [{ label: 'fib(2)' }] }, { label: 'fib(2)' }] },
          { label: 'fib(3)', children: [{ label: 'fib(2)' }, { label: 'fib(1)' }] },
        ],
      }],
    },
  },
  {
    type: 'layer-stack',
    data: {
      caption: 'fig. 5.1 — osi model',
      layers: [
        { label: 'application' },
        { label: 'presentation' },
        { label: 'session' },
        { label: 'transport', note: 'end-to-end' },
        { label: 'network', accent: true },
        { label: 'data link' },
        { label: 'physical' },
      ],
    },
  },
  {
    type: 'format-strip',
    data: {
      caption: 'fig. 6.1 — ethernet frame',
      fields: [
        { label: 'flag' },
        { label: 'header' },
        { label: 'payload', flex: 3, accent: true },
        { label: 'crc' },
      ],
    },
  },
  {
    type: 'format-strip',
    data: {
      caption: 'fig. 6.2 — em spectrum',
      fields: [
        { label: 'radio' }, { label: 'micro' }, { label: 'ir' },
        { label: 'visible', accent: true }, { label: 'uv' }, { label: 'x-ray' }, { label: 'gamma' },
      ],
      arrow: { direction: 'right', label: 'frequency increases' },
    },
  },
  {
    type: 'distribution-curve',
    data: {
      caption: 'fig. 1.3 — normal distribution (bell curve)',
      shape: 'normal',
      meanLabel: 'mean = median = mode',
      ticks: ['x-bar - 3s', 'x-bar - 1s', 'x-bar', 'x-bar + 1s', 'x-bar + 3s'],
      notes: ['68% within +/- 1 s', '95% within +/- 2 s'],
    },
  },
  {
    type: 'distribution-curve',
    data: {
      caption: 'fig. 2.1 — right-skewed distribution',
      shape: 'skewed-right',
      meanLabel: 'mean > median',
      ticks: ['min', 'median', 'mean', 'max'],
      notes: ['long right tail pulls the mean'],
    },
  },
  {
    type: 'distribution-curve',
    data: {
      caption: 'fig. 2.2 — poisson lumps',
      shape: 'poisson',
      ticks: ['0', '1', '2', '3'],
    },
  },
];

let fail = 0;
for (const spec of specs) {
  const r = renderDiagram(spec);
  const html = diagramFrame(r);
  const ok = r.svg.startsWith('<svg') && html.includes('diagram-wrap') && html.includes(r.caption);
  // geometry: all numeric coords inside the declared viewBox
  const vb = r.svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const [W, H] = vb.slice(1).map(Number);
  const coords = [...r.svg.matchAll(/(?:cx|cy|x1|x2|x|y1|y2|y)="(-?\d+(?:\.\d+)?)"/g)].map((m) => +m[1]);
  const inside = coords.every((c) => c >= -5 && c <= Math.max(W, H) + 5);
  // layer-stack/notes anchor inside band; strip labels within width
  console.log(`${ok && inside ? 'PASS' : 'FAIL'} ${spec.type} (${r.caption.slice(0, 24)}…): svg=${r.svg.length} chars, viewBox=${W}x${H}, in-range=${inside}`);
  if (!ok || !inside) {
    console.log(r.svg.slice(0, 400));
    fail++;
  }
}
process.exit(fail ? 1 : 0);
