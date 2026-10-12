import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SEED_NOTES } from "../seed";
import { CellDiagram, type DrawMode } from "./cell-diagram";
import { NoteEyebrow, Paper } from "./paper";

const EASE = [0.16, 1, 0.3, 1] as const;
const NOTE = SEED_NOTES[1]; // Biology 04 — Cell Structure & Function

/** Line widths for the dense textbook page: fixed bars, so no ragged orphans. */
const TEXT_LINES = [96, 100, 98, 100, 94, 100, 99, 62, 0, 100, 97, 100, 95, 100, 98, 100, 84];
const TEXT_LINES_2 = [100, 96, 100, 99, 100, 93, 100, 71];

function TextbookPage() {
  return (
    <div
      className="absolute inset-0 rounded-[2px] bg-[#e6e1d7] p-7 text-[#8b8478] shadow-[var(--shadow-paper)]"
      aria-hidden="true"
    >
      <div className="mb-5 flex justify-between font-mono text-[9px] tracking-[0.12em] text-[#9a9387]">
        <span>CHAPTER 4 · THE CELL</span>
        <span>112</span>
      </div>
      <div className="space-y-[7px]">
        {TEXT_LINES.map((w, i) =>
          w ? (
            <div key={i} className="h-[5px] rounded-full bg-current opacity-45" style={{ width: `${w}%` }} />
          ) : (
            <div key={i} className="h-[6px]" />
          ),
        )}
      </div>
      <div className="my-5 flex h-24 items-center justify-center border border-[#cdc6b9] bg-[#ddd7cb] font-mono text-[9px] tracking-[0.1em] text-[#9a9387]">
        FIG. 4.1 — ELECTRON MICROGRAPH ×12 000
      </div>
      <div className="space-y-[7px]">
        {TEXT_LINES_2.map((w, i) => (
          <div key={i} className="h-[5px] rounded-full bg-current opacity-45" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function NoteSheet({ mode, delay }: { mode: DrawMode; delay: number }) {
  return (
    <Paper tape className="px-6 pt-7 pb-4 sm:px-8 sm:pt-8">
      <NoteEyebrow>
        {NOTE.subject} · Chapter {NOTE.num}
      </NoteEyebrow>
      <div data-testid="hero-note-title" className="mt-2 font-display text-[24px] leading-[1.1] font-semibold text-ink sm:text-[28px]">
        {NOTE.title}
      </div>
      <div className="my-4 border-t border-dashed border-ink/30" />
      <p className="text-[14px] leading-[1.55] text-ink sm:text-[14.5px]">{NOTE.summary}</p>
      <ul className="mt-4 space-y-2 text-[13.5px] leading-[1.45] text-ink">
        {NOTE.points.slice(0, 2).map((p) => (
          <li key={p.lead} className="flex gap-2.5">
            <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-rust" />
            <span>
              <strong className="font-semibold">{p.lead}</strong> — {p.rest}
            </span>
          </li>
        ))}
      </ul>
      <CellDiagram mode={mode} delay={delay} className="mt-2 w-full" />
    </Paper>
  );
}

/**
 * The page's one orchestrated moment: a dense textbook page lands on the desk,
 * a stroke of rust ink crosses it, and the Quillpad note rises in its place
 * while its figure redraws itself. Plays once when seen; replayable.
 */
export function DistillSequence() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.45 });
  // read the motion preference only after mount, so the pre-rendered HTML and
  // the first client render agree
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduce = mounted && Boolean(prefersReduced);
  const [run, setRun] = useState(0);

  // hidden → playing (when seen) ; reduced motion jumps straight to the end
  const phase: "hidden" | "play" | "done" = reduce ? "done" : seen ? "play" : "hidden";
  const instant = { duration: 0 };

  const pageHidden = { opacity: 0, y: 40, rotate: 7, scale: 1 };
  const pageEnd = { opacity: 0.55, y: -6, rotate: 6, scale: 0.96 };
  const noteHidden = { opacity: 0, y: 70, rotate: -4 };
  const noteEnd = { opacity: 1, y: 0, rotate: -1.5 };

  return (
    <div className="relative">
      <div
        ref={ref}
        key={run}
        className="relative mx-auto w-full max-w-[460px] pt-4 pl-4 sm:pl-8"
        aria-label={`A dense textbook page turning into the Quillpad note “${NOTE.title}”`}
        role="img"
      >
        {/* the source chapter page, tucked behind the note */}
        <motion.div
          className="absolute top-0 bottom-6 left-0 w-[86%]"
          initial={pageHidden}
          animate={
            phase === "play"
              ? { opacity: [0, 1, 1, 0.55], y: [40, 0, 0, -6], rotate: [7, 5, 5, 6], scale: [1, 1, 1, 0.96] }
              : phase === "done"
                ? pageEnd
                : pageHidden
          }
          transition={phase === "play" ? { duration: 2.4, times: [0, 0.3, 0.62, 1], ease: EASE } : instant}
        >
          <TextbookPage />
        </motion.div>

        {/* the rust ink stroke */}
        <svg
          viewBox="0 0 400 520"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <motion.path
            d="M -10 430 C 70 380, 120 330, 190 280 S 330 150, 420 60"
            stroke="#bc5a32"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={phase === "play" ? { pathLength: [0, 1, 1], opacity: [1, 1, 0] } : { pathLength: 0, opacity: 0 }}
            transition={phase === "play" ? { duration: 1.5, delay: 0.75, times: [0, 0.55, 1], ease: "easeInOut" } : instant}
          />
        </svg>

        {/* the distilled note — its content sets the height of the whole piece */}
        <motion.div
          className="relative z-10 ml-auto w-[94%]"
          initial={noteHidden}
          animate={phase === "hidden" ? noteHidden : noteEnd}
          transition={phase === "play" ? { duration: 0.9, delay: 1.45, ease: EASE } : instant}
        >
          <NoteSheet mode={phase === "play" ? "draw" : phase === "done" ? "instant" : "hidden"} delay={2.1} />
        </motion.div>
      </div>

      {!reduce && (
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="mt-6 block w-full text-center text-sm text-cream-soft underline decoration-cream-soft/40 underline-offset-4 transition-colors hover:text-cream"
        >
          Play it again
        </button>
      )}
    </div>
  );
}
