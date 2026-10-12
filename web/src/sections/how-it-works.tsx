import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AppFrame } from "../components/app-frame";
import { CellDiagram } from "../components/cell-diagram";
import { NoteEyebrow } from "../components/paper";
import { SEED_NOTES } from "../seed";

const NOTE = SEED_NOTES[1];

const STEPS = [
  {
    title: "Drop in a chapter",
    body: "A PDF, Word file or PowerPoint — scanned pages too. Add the questions your teacher flagged, if you have them.",
  },
  {
    title: "Get a real note",
    body: "A short summary, the points that matter, your questions answered from the chapter itself, and its diagrams redrawn.",
  },
  {
    title: "Study it",
    body: "Flashcards that bring back what you missed, quick quizzes, and timed mock exams built from your own notes.",
  },
];

function ImportView() {
  return (
    <div className="flex h-full items-center justify-center bg-ink/10 p-5">
      <div className="paper w-full max-w-[320px] rounded-md p-5 text-[12px]">
        <NoteEyebrow>Import chapter</NoteEyebrow>
        <div className="mt-1 font-display text-[18px] font-semibold">Chapter to note</div>
        <dl className="mt-3 space-y-2">
          {[
            ["Chapter file", "ch04-cell-biology.pdf"],
            ["Subject", "Biology"],
            ["Chapter", "04 · Cell Structure & Function"],
            ["Your questions", "Why do mitochondria have their own DNA?"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[8.5px] tracking-[0.12em] text-ink-soft uppercase">{k}</dt>
              <dd className="rounded-[3px] border border-ink/15 bg-paper px-2 py-1">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-ink-soft">
            <span className="size-3 animate-spin rounded-full border-2 border-rust border-t-transparent" />
            distilling…
          </span>
          <span className="rounded-full bg-rust-deep px-3 py-1 text-[11px] font-semibold text-paper">distill chapter</span>
        </div>
      </div>
    </div>
  );
}

function NoteView() {
  return (
    <div className="h-full overflow-hidden px-6 py-5">
      <NoteEyebrow>
        {NOTE.subject} · Chapter {NOTE.num}
      </NoteEyebrow>
      <div className="mt-1 font-display text-[22px] leading-tight font-semibold">{NOTE.title}</div>
      <div className="my-2.5 border-t border-dashed border-ink/30" />
      <p className="text-[12px] leading-[1.5]">{NOTE.summary}</p>
      <div className="mt-3 grid grid-cols-[1fr_150px] gap-3">
        <ul className="space-y-1.5 text-[11px] leading-[1.4]">
          {NOTE.points.slice(0, 4).map((p) => (
            <li key={p.lead}>
              <strong className="font-semibold">{p.lead}</strong> — {p.rest}
            </li>
          ))}
        </ul>
        <CellDiagram className="w-full" />
      </div>
    </div>
  );
}

function StudyView() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-paper-deep p-6">
      <div className="mb-3 flex w-full max-w-[330px] justify-between font-mono text-[9px] tracking-[0.12em] text-ink-soft uppercase">
        <span>Card 3 of 12</span>
        <span>Biology 04</span>
      </div>
      <div className="paper w-full max-w-[330px] rounded-md p-6">
        <div className="font-mono text-[9px] tracking-[0.12em] text-rust-deep uppercase">Recall</div>
        <div className="mt-2 font-display text-[19px] leading-snug font-semibold">
          Why does the mitochondrion have its own DNA?
        </div>
        <div className="mt-4 border-t border-dashed border-ink/30 pt-3 text-[12px] leading-[1.5] text-ink-soft">
          It was once a free-living bacterium — the endosymbiotic origin. It still copies itself and makes some of its own proteins.
        </div>
      </div>
      <div className="mt-4 flex gap-2 text-[11px]">
        <span className="rounded-full border border-ink/20 px-3 py-1">missed it</span>
        <span className="rounded-full bg-ink px-3 py-1 text-paper">got it</span>
      </div>
    </div>
  );
}

const VIEWS = [ImportView, NoteView, StudyView];

export function HowItWorks() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (paused || !inView || reduce) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 4500);
    return () => clearTimeout(t);
  }, [step, paused, inView, reduce]);

  const View = VIEWS[step];

  return (
    <section id="how" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 lg:py-24">
      <h2 className="max-w-2xl text-[clamp(2.1rem,4.2vw,3.4rem)] leading-[1.06] text-cream">
        From a 40-page chapter to one clear page, in about a minute.
      </h2>
      <div
        ref={ref}
        className="mt-14 grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <ol className="space-y-2">
          {STEPS.map((s, i) => {
            const on = i === step;
            return (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={on ? "step" : undefined}
                  className={`group w-full rounded-lg border px-5 py-4 text-left transition-colors ${
                    on ? "border-desk-line bg-desk-raised" : "border-transparent hover:bg-desk-raised/50"
                  }`}
                >
                  <div className="flex items-baseline gap-4">
                    <span className={`font-display text-[22px] italic ${on ? "text-rust-bright" : "text-cream-soft"}`}>
                      {i + 1}
                    </span>
                    <div>
                      <div className={`font-display text-[21px] font-semibold ${on ? "text-cream" : "text-cream-soft"}`}>
                        {s.title}
                      </div>
                      <p className={`mt-1 text-[15.5px] leading-[1.55] text-cream-soft ${on ? "" : "hidden lg:block lg:opacity-70"}`}>
                        {s.body}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
        <div aria-live="polite">
          <AppFrame active="Biology04">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                className="h-full"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                <View />
              </motion.div>
            </AnimatePresence>
          </AppFrame>
          <p className="sr-only">Showing step {step + 1}: {STEPS[step].title}</p>
        </div>
      </div>
    </section>
  );
}
