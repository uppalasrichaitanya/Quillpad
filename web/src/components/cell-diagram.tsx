import { motion } from "motion/react";
import { useId } from "react";

const INK = "#362b1e";
const RUST = "#bc5a32";
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The generalised animal cell, drawn the way Quillpad redraws a figure: wobbly
 * ink line art, dashed leader lines, handwritten labels. With `draw`, strokes
 * ink themselves in; otherwise the finished figure renders statically.
 */
export function CellDiagram({
  draw = false,
  delay = 0,
  className = "",
}: {
  draw?: boolean;
  delay?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const stroke = (d: number) =>
    draw
      ? {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: {
            pathLength: { delay: delay + d, duration: 0.9, ease: EASE },
            opacity: { delay: delay + d, duration: 0.15 },
          },
        }
      : {};
  const fade = (d: number) =>
    draw
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { delay: delay + d, duration: 0.4 },
        }
      : {};

  const labels: [number, number, number, number, number, number, string][] = [
    // x1,y1 (part)  x2,y2 (label end)  tx,ty  text
    [212, 120, 262, 62, 266, 58, "nucleus"],
    [150, 112, 92, 66, 30, 62, "rough ER"],
    [118, 228, 60, 278, 18, 292, "mitochondrion"],
    [292, 192, 344, 214, 330, 232, "membrane"],
  ];

  return (
    <svg viewBox="0 0 400 310" className={className} fill="none" role="img" aria-label="Hand-drawn animal cell with nucleus, rough ER, mitochondrion and membrane labelled">
      <defs>
        <filter id={`wobble-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="5" />
        </filter>
      </defs>
      <g filter={`url(#wobble-${id})`} stroke={INK} strokeWidth="2.2" strokeLinecap="round">
        <motion.ellipse cx="200" cy="160" rx="118" ry="98" {...stroke(0)} />
        <motion.circle cx="212" cy="140" r="33" stroke={RUST} strokeWidth="2.8" {...stroke(0.3)} />
        <motion.ellipse cx="212" cy="140" rx="11" ry="7" stroke={RUST} strokeWidth="1.6" {...stroke(0.55)} />
        <motion.ellipse cx="122" cy="214" rx="27" ry="12" transform="rotate(-16 122 214)" {...stroke(0.45)} />
        <motion.path d="M 102 212 C 108 207, 114 217, 120 212 S 132 207, 138 214" strokeWidth="1.5" {...stroke(0.65)} />
        <motion.ellipse cx="270" cy="220" rx="25" ry="11" transform="rotate(12 270 220)" {...stroke(0.55)} />
        <motion.path d="M 252 220 C 258 215, 264 225, 270 220 S 282 215, 288 222" strokeWidth="1.5" {...stroke(0.75)} />
        <motion.path d="M 140 104 C 154 92, 172 92, 184 102" {...stroke(0.6)} />
        <motion.path d="M 142 114 C 156 102, 174 102, 186 112" strokeWidth="1.6" {...stroke(0.7)} />
        <motion.path d="M 148 124 C 160 114, 176 114, 186 122" strokeWidth="1.4" {...stroke(0.8)} />
        {[
          [186, 101],
          [188, 111],
          [148, 123],
          [182, 250],
          [194, 256],
          [172, 258],
        ].map(([cx, cy], i) => (
          <motion.circle key={i} cx={cx} cy={cy} r="2.5" fill={INK} stroke="none" {...fade(0.9 + i * 0.04)} />
        ))}
      </g>
      <g stroke={INK} strokeWidth="1" strokeDasharray="3 4" opacity="0.7">
        {labels.map(([x1, y1, x2, y2], i) => (
          <motion.line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...fade(1.0 + i * 0.08)} />
        ))}
      </g>
      <g fill={INK} fontFamily="Caveat, cursive" fontSize="19">
        {labels.map(([, , , , tx, ty, t], i) => (
          <motion.text key={t} x={tx} y={ty} {...fade(1.1 + i * 0.08)}>
            {t}
          </motion.text>
        ))}
      </g>
    </svg>
  );
}
