// Proof: diagram rendering bakes the active palette, and switching themes
// then re-rendering (what applyTheme's re-render hook does) produces a
// midnight-palette SVG with zero light-palette remnants. This is the exact
// mechanism that was missing when the user's screenshot showed light
// diagrams on a dark page.
import { renderDiagram, setDiagramTheme } from '../src/diagrams.js';

const LIGHT = { ink: '#362B1E', inkSoft: '#6C5D49', rust: '#BC5A32', tintAccent: '#F3DFD0', tintAlt: '#E7DCC8' };
const MIDNIGHT = { ink: '#E9DCC4', inkSoft: '#B3A184', rust: '#D0744A', tintAccent: '#3E2A1E', tintAlt: '#352818' };

let fail = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) fail++;
};

const LIGHT_REMNANTS = ['#362B1E', '#6C5D49', '#BC5A32', '#F3DFD0', '#E7DCC8'];
const MIDNIGHT_MARKS = ['#E9DCC4', '#B3A184', '#D0744A', '#3E2A1E', '#352818'];

const specs = [
  { type: 'layer-stack', data: { caption: 'OSI', layers: ['Physical', 'Data link', 'Network', 'Transport', 'Session', 'Presentation', 'Application'] } },
  { type: 'distribution-curve', data: { caption: 'normal', shape: 'normal', mean_label: 'µ', ticks: ['-2', '-1', '0', '1', '2'], notes: [] } },
  { type: 'format-strip', data: { caption: 'frame', fields: ['Preamble', 'Dest', 'Src', 'Type', 'Payload', 'CRC'] } },
  { type: 'process-flow', data: { caption: 'steps', steps: ['encode', 'transmit', 'decode', 'verify'] } },
  { type: 'labelled-blob', data: { caption: 'cell', parts: [{ label: 'nucleus', kind: 'dot' }, { label: 'wall', kind: 'edge' }] } },
  { type: 'tree', data: { caption: 'sets', trees: [{ label: 'disjoint sets', children: [{ label: 'union' }, { label: 'find' }] }] } },
  { type: 'trend-grid', data: { caption: 'trend', points: [{ label: 'a', x: 1, y: 2 }, { label: 'b', x: 3, y: 5 }] } },
];

for (const d of specs) {
  // light first (page loads in light)
  setDiagramTheme(LIGHT);
  const lightSvg = renderDiagram(d).svg;
  // toggle: switch theme + re-render (the hook's behavior)
  setDiagramTheme(MIDNIGHT);
  const midSvg = renderDiagram(d).svg;

  const lightRemnantsInMid = LIGHT_REMNANTS.filter((c) => midSvg.includes(c));
  const midMarks = MIDNIGHT_MARKS.filter((c) => midSvg.includes(c));
  check(
    `${d.type}: re-render swaps palette (remnants: ${lightRemnantsInMid.length}, midnight marks: ${midMarks.length})`,
    lightRemnantsInMid.length === 0 && midMarks.length > 0,
  );
}

// curve area fill adapts (special-cased in renderer)
setDiagramTheme(LIGHT);
const lightCurve = renderDiagram(specs[1]).svg;
setDiagramTheme(MIDNIGHT);
const midCurve = renderDiagram(specs[1]).svg;
check('curve area fill light = brown 10%', lightCurve.includes('rgba(108,93,73,0.10)'));
check('curve area fill midnight = rust 12%', midCurve.includes('rgba(208,116,74,0.12)'));
check('mean_label renders in output', midCurve.includes('µ'));

console.log(fail ? `\n${fail} FAILED` : '\nall theme re-palette proofs passed');
process.exit(fail ? 1 : 0);
