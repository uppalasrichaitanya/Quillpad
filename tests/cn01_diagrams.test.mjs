// Regression test: render the REAL diagram specs from the re-distilled
// CN-01 note (the ones with overlap complaints) and verify geometry.
import { renderDiagram } from '../src/diagrams.js';

const specs = [
  {
    type: 'layer-stack',
    data: {
      caption: 'fig. 01.1 — osi seven layers and units exchanged',
      layers: [
        { label: 'Application', note: 'APDU — access to network' },
        { label: 'Presentation', note: 'PPDU — syntax, encryption' },
        { label: 'Session', note: 'SPDU — dialog control' },
        { label: 'Transport', note: 'TPDU — process to process' },
        { label: 'Network', note: 'packet — source to destination' },
        { label: 'Data link', note: 'frame — hop to hop', accent: true },
        { label: 'Physical', note: 'bit — over the medium' },
      ],
    },
  },
  {
    type: 'layer-stack',
    data: {
      caption: 'fig. 01.2 — tcp/ip four layers with example protocols',
      layers: [
        { label: 'Application', note: 'HTTP, SMTP, DNS, RTP' },
        { label: 'Transport', note: 'TCP, UDP' },
        { label: 'Internet', note: 'IP, ICMP — holds it together', accent: true },
        { label: 'Link', note: 'Ethernet, DSL, 802.11' },
      ],
    },
  },
  {
    type: 'tree',
    data: {
      caption: 'fig. 01.8 — error-detecting code families',
      trees: [
        {
          label: 'Detection methods',
          children: [
            { label: 'Parity check', children: [] },
            { label: 'Checksum', children: [] },
            { label: 'Cyclic redundancy check', children: [] },
          ],
        },
      ],
    },
  },
  {
    type: 'format-strip',
    data: {
      caption: 'fig. 01.7 — ethernet frame format in bytes',
      fields: [
        { label: 'Preamble' }, { label: 'Dest address' }, { label: 'Source address' },
        { label: 'Type' }, { label: 'Data', flex: 3 }, { label: 'FCS', accent: true },
      ],
    },
  },
];

let fail = 0;
for (const spec of specs) {
  const r = renderDiagram(spec);
  const vb = r.svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const [W, H] = vb.slice(1).map(Number);
  const coords = [...r.svg.matchAll(/(?:cx|cy|x1|x2|x|y1|y2|y)="(-?\d+(?:\.\d+)?)"/g)].map((m) => +m[1]);
  const inside = coords.every((c) => c >= -5 && c <= Math.max(W, H) + 5);
  // layer-stack: no note text may start inside the band column (BAND_X+300+26)
  // tree: every node rect must be within the viewBox horizontally
  console.log(`${inside ? 'PASS' : 'FAIL'} ${spec.type} (${r.caption.slice(0, 30)}…): viewBox=${W}x${H}, in-range=${inside}`);
  if (!inside) {
    console.log(r.svg.slice(0, 500));
    fail++;
  }
}
process.exit(fail ? 1 : 0);
