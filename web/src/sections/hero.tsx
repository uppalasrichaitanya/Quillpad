/** Hero: the product's own page. Cream paper, a dashed margin rule with a
 *  handwritten note hanging off it, a giant serif headline with a rust
 *  emphasis stroke, and the distilled Biology 04 note as the specimen card.
 *  The quill trail draws itself behind it all. */

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { QuillTrail } from "../components/bloom";
import { WordMask } from "../components/motion-primitives";
import { StackedSheet, Tape } from "../components/sheet";
import { Button, QuillMark } from "../components/ui";
import { DOWNLOAD, formatBytes } from "../download-info";

/** Pointer-follow tilt for the specimen sheet: paper reacting to a hand.
 *  Desktop + hover-capable pointers only; still under reduced motion. */
function useTilt() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { damping: 22, mass: 0.6, stiffness: 160 };
  const rx = useSpring(useTransform(py, [0, 1], [4, -4]), spring);
  const ry = useSpring(useTransform(px, [0, 1], [-5, 5]), spring);
  const canHover =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const handlers =
    reduce || !canHover
      ? {}
      : {
          onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
            const r = e.currentTarget.getBoundingClientRect();
            px.set((e.clientX - r.left) / r.width);
            py.set((e.clientY - r.top) / r.height);
          },
          onMouseLeave: () => {
            px.set(0.5);
            py.set(0.5);
          },
        };
  return { rx, ry, handlers };
}

const DRAW = (delay: number) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: {
    pathLength: { delay, duration: 1.1, ease: [0.16, 1, 0.3, 1] },
    opacity: { delay, duration: 0.1 },
  },
});

const FADE = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 0.5, ease: "easeOut" },
});

/** Hand-drawn rust swoosh under the accent words, drawn in on load. */
function EmphasisStroke() {
  const reduce = useReducedMotion();
  return (
    <svg
      viewBox="0 0 300 40"
      className="block h-[0.45em] w-[92%]"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="qpWobble">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.045"
            numOctaves="2"
            seed="11"
          />
          <feDisplacementMap in="SourceGraphic" scale="7" />
        </filter>
      </defs>
      <motion.path
        d="M 6 28 C 70 14, 150 10, 294 16"
        fill="none"
        stroke="#b1512c"
        strokeWidth="7"
        strokeLinecap="round"
        filter="url(#qpWobble)"
        initial={reduce ? false : { pathLength: 0 }}
        animate={reduce ? undefined : { pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 1.15 }}
      />
    </svg>
  );
}

/** The Biology 04 animal cell, drawn the way the app draws it: wobbled
 *  single-weight strokes, dashed leader lines, Caveat labels. */
function CellDiagram() {
  const reduce = useReducedMotion();
  const draw = (delay: number) => (reduce ? {} : DRAW(delay));
  const fade = (delay: number) => (reduce ? {} : FADE(delay));

  return (
    <svg
      viewBox="0 0 400 320"
      className="h-auto w-full"
      role="img"
      aria-label="Hand-drawn diagram of an animal cell with the nucleus, mitochondria, rough ER, ribosomes and membrane labelled"
    >
      <defs>
        <filter id="qpCell">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.028"
            numOctaves="2"
            seed="17"
          />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </defs>

      <g
        fill="none"
        stroke="#362b1e"
        strokeWidth="2.5"
        strokeLinecap="round"
        filter="url(#qpCell)"
      >
        <motion.ellipse cx="195" cy="168" rx="120" ry="100" {...draw(0.2)} />
        <motion.circle cx="212" cy="148" r="34" stroke="#b1512c" strokeWidth="3" {...draw(0.5)} />
        <motion.ellipse cx="212" cy="148" rx="11" ry="7" stroke="#b1512c" strokeWidth="1.6" opacity="0.7" {...draw(0.8)} />
        <motion.ellipse cx="118" cy="216" rx="27" ry="12" transform="rotate(-16 118 216)" {...draw(0.7)} />
        <motion.path d="M 98 214 C 104 209, 110 219, 116 214 S 128 209, 134 216" strokeWidth="1.6" {...draw(0.9)} />
        <motion.ellipse cx="268" cy="226" rx="27" ry="12" transform="rotate(12 268 226)" {...draw(0.8)} />
        <motion.path d="M 248 226 C 254 221, 260 231, 266 226 S 278 221, 284 228" strokeWidth="1.6" {...draw(1)} />
        <motion.path d="M 138 108 C 152 96, 170 96, 182 106" {...draw(0.9)} />
        <motion.path d="M 140 118 C 154 106, 172 106, 184 116" strokeWidth="1.6" {...draw(1)} />
        <motion.path d="M 146 128 C 158 118, 174 118, 184 126" strokeWidth="1.4" {...draw(1.1)} />
        <motion.circle cx="183" cy="105" r="2.6" fill="#362b1e" stroke="none" {...fade(1.3)} />
        <motion.circle cx="185" cy="115" r="2.6" fill="#362b1e" stroke="none" {...fade(1.35)} />
        <motion.circle cx="145" cy="127" r="2.6" fill="#362b1e" stroke="none" {...fade(1.4)} />
        <motion.circle cx="180" cy="258" r="2.6" fill="#362b1e" stroke="none" {...fade(1.45)} />
        <motion.circle cx="192" cy="264" r="2.6" fill="#362b1e" stroke="none" {...fade(1.5)} />
        <motion.circle cx="170" cy="266" r="2.6" fill="#362b1e" stroke="none" {...fade(1.55)} />
      </g>

      <g>
        <motion.line x1="58" y1="34" x2="86" y2="76" stroke="#6c5d49" strokeWidth="1.4" strokeDasharray="3 4" {...fade(1.6)} />
        <motion.line x1="316" y1="112" x2="248" y2="136" stroke="#6c5d49" strokeWidth="1.4" strokeDasharray="3 4" {...fade(1.65)} />
        <motion.line x1="52" y1="290" x2="96" y2="228" stroke="#6c5d49" strokeWidth="1.4" strokeDasharray="3 4" {...fade(1.7)} />
        <motion.line x1="330" y1="252" x2="292" y2="234" stroke="#6c5d49" strokeWidth="1.4" strokeDasharray="3 4" {...fade(1.75)} />
        <motion.line x1="222" y1="84" x2="188" y2="110" stroke="#6c5d49" strokeWidth="1.4" strokeDasharray="3 4" {...fade(1.8)} />
      </g>

      <g className="hand" fill="#5c513e" fontSize="18">
        <motion.text x="14" y="30" {...fade(1.7)}>membrane</motion.text>
        <motion.text x="320" y="108" {...fade(1.75)}>nucleus</motion.text>
        <motion.text x="20" y="306" {...fade(1.8)}>mitochondrion</motion.text>
        <motion.text x="334" y="268" {...fade(1.85)}>ER</motion.text>
        <motion.text x="226" y="76" {...fade(1.9)}>rough ER, ribosomes</motion.text>
      </g>
    </svg>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const tilt = useTilt();

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative min-h-svh overflow-hidden"
    >
      <QuillTrail />

      <span
        aria-hidden="true"
        className="hand absolute left-1 top-1/2 z-[5] hidden -translate-y-1/2 text-2xl text-ink-faint [writing-mode:vertical-rl] xl:block"
      >
        <span className="inline-block rotate-180">
          the margin is where the real thinking happens
        </span>
      </span>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center px-6 pt-24">
        <div className="grid items-end gap-12 lg:grid-cols-[1.15fr_24rem]">
          {/* headline block */}
          <div className="pb-4" data-quiet="1">
            <motion.p
              initial={reduce ? undefined : { opacity: 0, y: 12 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="kicker"
            >
              For the chapters you keep re-reading
            </motion.p>

            <h1
              id="hero-title"
              className="mt-6 font-display text-hero font-semibold leading-[0.98] tracking-[-0.01em]"
            >
              <WordMask words={["Read", "the", "chapter."]} />
              <br />
              <span className="relative inline-block italic">
                <WordMask words={["Keep", "the", "margin."]} accentFrom={2} />
                <span className="-mt-2 block" aria-hidden="true">
                  <EmphasisStroke />
                </span>
              </span>
            </h1>

            <motion.p
              initial={reduce ? undefined : { opacity: 0, y: 12 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft"
            >
              Drop in a chapter PDF. Quillpad reads it like a diligent
              classmate and hands back the page you wish you had written: the
              summary, the points that matter, your questions answered, every
              figure redrawn by hand. Plain files, on your disk.
            </motion.p>

            <motion.div
              initial={reduce ? undefined : { opacity: 0, y: 12 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Button
                href={DOWNLOAD.href}
                download={DOWNLOAD.fileName}
                className="px-7 py-3.5 text-base"
              >
                <QuillMark className="h-5 w-5 text-white" />
                Download for Windows
              </Button>
              <a
                href="#transform"
                className="rounded px-1 py-1.5 text-sm font-medium text-ink-soft underline decoration-line-strong decoration-2 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-rust"
              >
                Watch a chapter distill
              </a>
              <p className="w-full text-sm text-ink-faint">
                v{DOWNLOAD.version} · {formatBytes(DOWNLOAD.sizeBytes)} · no
                installer, no account
              </p>
            </motion.div>
          </div>

          {/* the specimen card */}
          <motion.div
            data-quiet="1"
            initial={reduce ? undefined : { opacity: 0, y: 24, rotate: 0 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto mt-10 w-full max-w-sm rotate-[1.2deg] lg:mx-0 lg:-mt-6 lg:w-[23rem] lg:rotate-[1.8deg]"
          >
            <div className={reduce ? undefined : "floaty"}>
              <motion.div
                style={{
                  rotateX: reduce ? undefined : tilt.rx,
                  rotateY: reduce ? undefined : tilt.ry,
                  transformPerspective: 900,
                }}
                {...tilt.handlers}
              >
                <StackedSheet tilt={1} className="p-6">
                  <Tape at="tl" />
                  <Tape at="tr" />
              <div className="flex items-baseline justify-between border-b border-dashed border-line-strong pb-3">
                <span className="kicker">Biology · 04</span>
                <span className="rounded-full bg-rust-tint px-3 py-1 font-meta text-[11px] text-rust-deep">
                  distilled
                </span>
              </div>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight">
                Cell Structure &amp; Function
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Every organelle in the cell has one job and does it well. The
                cell is a tiny factory: nucleus is the office, mitochondria the
                power plant, ribosomes the assembly line.
              </p>
              <div className="mt-4 border-t border-dashed border-line-strong pt-4">
                <CellDiagram />
                <p className="mt-1 font-meta text-[11px] text-ink-faint">
                  fig. 4.1 · generalised animal cell, organelles labelled
                </p>
              </div>
                </StackedSheet>
              </motion.div>
            </div>
            <span
              aria-hidden="true"
              className="hand absolute -right-2 top-full mt-2 rotate-3 text-2xl text-rust-deep"
            >
              nucleus = control · mitochondria = power
            </span>
          </motion.div>
        </div>

        {/* in-flow scroll hint where the section runs past the fold */}
        <motion.div
          initial={reduce ? undefined : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mx-auto mt-12 flex items-center justify-center gap-3 text-ink-faint xl:hidden"
          aria-hidden="true"
        >
          <span className="font-meta text-[11px] uppercase tracking-[0.24em]">
            scroll
          </span>
          <span className="block h-10 w-px bg-line-strong" />
        </motion.div>
      </div>

      {/* quiet scroll hint, desktop: pinned to the fold */}
      <motion.div
        initial={reduce ? undefined : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 text-ink-faint xl:flex"
        aria-hidden="true"
      >
        <span className="font-meta text-[11px] uppercase tracking-[0.24em]">
          scroll
        </span>
        <span className="block h-px w-10 bg-line-strong" />
      </motion.div>
    </section>
  );
}
