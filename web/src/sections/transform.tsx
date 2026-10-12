/** Plate 01: the transformation, restaged. A typeset textbook page on the
 *  desk (tilted, real tiny prose, figure box, page number) recedes while the
 *  distilled note page assembles on the right: dashed rules drawing in,
 *  a rust quill marking each landing element. Pinned scroll-scrub; static
 *  two-sheet layout under reduced motion. */

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { BIO_04 } from "../content";
import { StackedSheet } from "../components/sheet";
import { QuillMark } from "../components/ui";

const CHAPTER_LINES = [
  "The cell theory states that all organisms are composed of cells, and that",
  "the cell is the basic unit of structure and function in living organisms.",
  "During the 19th century, Schleiden and Schwann produced the first formal",
  "version of this theory after studying plant and animal tissue under early",
  "compound microscopes. The nucleus was described years before its role was",
  "understood; the cell membrane's bilayer structure came even later, once",
  "physical chemistry made lipid behaviour measurable. In this chapter we",
  "catalogue the major organelles of the eukaryotic cell and describe how",
  "each contributes to the cell as a functioning whole: the nucleus stores",
  "the genetic instructions, mitochondria convert glucose into usable energy,",
  "ribosomes translate messenger RNA into proteins, the Golgi apparatus",
  "modifies and packages them, and the membrane governs what enters and exits.",
];

function TextbookSheet({ p }: { p: MotionValue<number> }) {
  const rot = useTransform(p, [0, 0.5], [-1.6, -4.5]);
  const y = useTransform(p, [0, 0.5], [0, 26]);
  const opacity = useTransform(p, [0, 0.42, 0.55], [1, 0.18, 0]);
  return (
    <motion.div style={{ rotate: rot, y, opacity }} className="will-change-transform">
      <StackedSheet tilt={-1} className="p-7">
        <div className="flex items-baseline justify-between border-b border-dashed border-line-strong pb-3">
          <span className="font-meta text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            chapter 04 · 41 pages
          </span>
          <span className="font-meta text-[10px] text-ink-faint">p. 112 of 236</span>
        </div>
        <div className="mt-4 font-display text-[13px] leading-[1.9] text-ink-soft">
          {CHAPTER_LINES.map((l, i) => (
            <p key={i} className="text-justify">{l}</p>
          ))}
        </div>
        <div className="mt-4 border border-dashed border-line-strong bg-card-deep p-4">
          <div className="flex h-24 items-center justify-center">
            <span className="font-meta text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              fig 4.1 · electron micrograph, ×: 12000
            </span>
          </div>
          <p className="mt-2 font-meta text-[10px] text-ink-faint">
            4.1. See also exercises 4.6–4.9 and the electron transport chain in §5.
          </p>
        </div>
        <div className="mt-4 font-display text-[13px] leading-[1.9] text-ink-soft">
          <p className="text-justify">
            The surfaces of organelles are not decorative. The folds of the
            inner mitochondrial membrane, the cristae, multiply the area on
            which respiration chemistry runs.
          </p>
        </div>
      </StackedSheet>
    </motion.div>
  );
}

function NoteSheet({ p }: { p: MotionValue<number> }) {
  const at = (a: number, b: number) => ({
    opacity: useTransform(p, [a, b], [0, 1]),
    y: useTransform(p, [a, b], [10, 0]),
  });
  const head = at(0.38, 0.5);
  const summary = at(0.5, 0.6);
  const ruleScale = useTransform(p, [0.4, 0.55], [0, 1]);
  const points = [at(0.58, 0.66), at(0.64, 0.72), at(0.7, 0.78)];
  const recap = at(0.8, 0.92);
  const nibX = useTransform(p, [0.38, 0.9], [0, 180]);
  const nibOp = useTransform(p, [0.38, 0.82, 0.9], [1, 1, 0]);
  const sheetOp = useTransform(p, [0.28, 0.42], [0, 1]);
  const sheetY = useTransform(p, [0.28, 0.42], [18, 0]);

  return (
    <motion.div style={{ opacity: sheetOp, y: sheetY }}>
      <StackedSheet tilt={1} className="p-7">
        <motion.div style={head}>
          <p className="kicker">Biology · 04 · distilled</p>
          <h3 className="mt-3 font-display text-3xl font-semibold leading-tight">
            {BIO_04.meta.title}
          </h3>
        </motion.div>
        <motion.div
          style={{ scaleX: ruleScale }}
          className="mt-4 origin-left border-t border-dashed border-rust-soft"
        />
        <motion.p style={summary} className="mt-4 text-sm leading-relaxed text-ink-soft">
          {BIO_04.summary}
        </motion.p>
        <ul className="mt-4 flex flex-col gap-3">
          {BIO_04.keyPoints.slice(0, 3).map((kp, i) => (
            <motion.li key={kp.lead} style={points[i]} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rust" />
              <span className="text-sm leading-relaxed text-ink-soft">
                <span className="font-medium text-rust-deep">{kp.lead}</span>: {kp.rest}
              </span>
            </motion.li>
          ))}
        </ul>
        <motion.div
          style={recap}
          className="relative mt-6 border border-dashed border-rust-soft p-4"
        >
          <span className="hand absolute -top-3.5 left-4 bg-card px-2 text-lg text-rust-deep">
            the recap
          </span>
          <p className="text-sm text-ink-soft">{BIO_04.recap}</p>
        </motion.div>
        <motion.div
          style={{ opacity: nibOp, x: nibX }}
          className="pointer-events-none absolute right-4 top-4"
        >
          <QuillMark className="h-7 w-7 text-rust" />
        </motion.div>
      </StackedSheet>
    </motion.div>
  );
}

function Captions({ p }: { p: MotionValue<number> }) {
  const one = useTransform(p, [0, 0.26], [1, 0]);
  const two = useTransform(p, [0.34, 0.42, 0.62, 0.7], [0, 1, 1, 0]);
  const three = useTransform(p, [0.74, 0.9], [0, 1]);
  const cls = "absolute inset-x-0 text-center font-meta text-[11px] uppercase tracking-[0.22em] text-ink-faint";
  return (
    <div className="absolute inset-x-0 bottom-8 h-5">
      <motion.span style={{ opacity: one }} className={cls}>41 pages of this</motion.span>
      <motion.span style={{ opacity: two }} className={cls}>kept, cut, re-inked</motion.span>
      <motion.span style={{ opacity: three }} className={cls}>one page that remembers it</motion.span>
    </div>
  );
}

export function Transform() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  if (reduce) {
    return (
      <section id="transform" aria-labelledby="transform-title" className="px-6 py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-2">
          <div className="opacity-45">
            <StaticChapter />
          </div>
          <StaticNote />
        </div>
      </section>
    );
  }

  return (
    <section id="transform" aria-labelledby="transform-title" ref={ref} className="relative h-[340vh]">
      <h2 id="transform-title" className="sr-only">
        The transformation: a chapter page becomes a note
      </h2>
      <div className="sticky top-0 flex min-h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1fr_1.15fr]">
          <TextbookSheet p={scrollYProgress} />
          <NoteSheet p={scrollYProgress} />
        </div>
        <Captions p={scrollYProgress} />
      </div>
    </section>
  );
}

function StaticChapter() {
  return (
    <StackedSheet tilt={-1} className="p-7">
      <div className="flex items-baseline justify-between border-b border-dashed border-line-strong pb-3">
        <span className="font-meta text-[10px] uppercase tracking-[0.2em] text-ink-faint">chapter 04 · 41 pages</span>
      </div>
      <div className="mt-4 font-display text-[13px] leading-[1.9] text-ink-soft">
        {CHAPTER_LINES.slice(0, 8).map((l, i) => <p key={i} className="text-justify">{l}</p>)}
      </div>
    </StackedSheet>
  );
}

function StaticNote() {
  return (
    <StackedSheet tilt={1} className="p-7">
      <p className="kicker">Biology · 04 · distilled</p>
      <h2 id="transform-title" className="mt-3 font-display text-3xl font-semibold">
        {BIO_04.meta.title}
      </h2>
      <div className="mt-4 border-t border-dashed border-rust-soft" />
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">{BIO_04.summary}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {BIO_04.keyPoints.slice(0, 3).map((kp) => (
          <li key={kp.lead} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rust" />
            <span><span className="font-medium text-rust-deep">{kp.lead}</span>: {kp.rest}</span>
          </li>
        ))}
      </ul>
      <div className="relative mt-6 border border-dashed border-rust-soft p-4">
        <span className="hand absolute -top-3.5 left-4 bg-card px-2 text-lg text-rust-deep">the recap</span>
        <p className="text-sm text-ink-soft">{BIO_04.recap}</p>
      </div>
    </StackedSheet>
  );
}
