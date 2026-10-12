/** Plate 02 · Study desk: a fanned deck of real flashcards (top card flips,
 *  next card cycles the deck) and a quiz presented as exam paper where the
 *  teacher's pen circles the right answer and crosses the wrong ones. */

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FLASHCARDS, QUIZ } from "../content";
import { SectionHead } from "../components/ui";
import { Reveal } from "../components/motion-primitives";
import { StackedSheet, Tape } from "../components/sheet";

const DECK = [
  { t: -2.5, x: -10, y: 8 },
  { t: 1.2, x: 6, y: 4 },
  { t: 0, x: 0, y: 0 },
] as const;

function FlashDeck() {
  const reduce = useReducedMotion();
  const [order, setOrder] = useState([0, 1, 2]);
  const [flipped, setFlipped] = useState(false);
  const [announced, setAnnounced] = useState("");

  const flip = () => {
    setFlipped((f) => {
      const next = !f;
      setAnnounced(next ? "Answer shown" : "Question shown");
      return next;
    });
  };

  const next = () => {
    setFlipped(false);
    setOrder((o) => [...o.slice(1), o[0]]);
    setAnnounced("New card on top");
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-72 w-full max-w-[19rem] sm:max-w-sm">
        {order.map((cardIdx, slot) => {
          const s = DECK[slot];
          const isTop = slot === 2;
          return (
            <motion.button
              key={cardIdx}
              type="button"
              onClick={isTop ? flip : undefined}
              aria-hidden={isTop ? undefined : true}
              tabIndex={isTop ? 0 : -1}
              onKeyDown={(e) => {
                if (isTop && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  flip();
                }
              }}
              className="absolute inset-x-0 top-0 h-72 text-left [perspective:1200px]"
              initial={false}
              animate={
                reduce
                  ? { x: s.x, y: s.y, rotate: 0 }
                  : {
                      x: s.x,
                      y: s.y,
                      rotate: flipped && isTop ? 0 : s.t,
                      scale: isTop ? 1 : 0.98,
                    }
              }
              whileHover={isTop && !reduce ? { y: s.y - 4 } : undefined}
              transition={{ damping: 22, mass: 1, stiffness: 180 }}
            >
              <motion.div
                className="relative h-full w-full [transform-style:preserve-3d]"
                animate={
                  reduce || !isTop
                    ? undefined
                    : { rotateY: flipped ? 180 : 0 }
                }
                transition={{ damping: 22, stiffness: 180 }}
                style={
                  reduce && flipped && isTop
                    ? { transform: "rotateY(180deg)" }
                    : undefined
                }
              >
                <div
                  className="sheet absolute inset-0 flex flex-col justify-between p-6 [backface-visibility:hidden]"
                  aria-hidden={flipped && isTop}
                >
                  <span className="kicker">
                    card {cardIdx + 1} of {FLASHCARDS.length}
                  </span>
                  <p className="font-display text-2xl leading-snug">
                    {FLASHCARDS[cardIdx].front}
                  </p>
                  <span className="font-meta text-[11px] text-ink-faint">
                    {FLASHCARDS[cardIdx].source}
                  </span>
                </div>
                <div
                  className="sheet sheet-deep absolute inset-0 flex flex-col justify-between p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  aria-hidden={!(flipped && isTop)}
                >
                  <span className="kicker">answer</span>
                  <p className="text-base leading-relaxed text-ink">
                    {FLASHCARDS[cardIdx].back}
                  </p>
                  <span className="font-meta text-[11px] text-ink-faint">
                    tap to return
                  </span>
                </div>
              </motion.div>
            </motion.button>
          );
        })}
      </div>
      <p className="sr-only" role="status">
        {announced}
      </p>
      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={next}
          className="rounded-full border border-line-strong bg-card px-5 py-2 text-sm font-medium text-ink transition-colors duration-300 ease-out hover:border-rust hover:text-rust-deep"
        >
          next card
        </button>
        <span className="hand text-xl text-ink-faint">
          flip it. mean it.
        </span>
      </div>
    </div>
  );
}

/** Teacher's circle, drawn in over the chosen-correct option. */
function TeacherCircle() {
  const reduce = useReducedMotion();
  return (
    <svg
      className="pointer-events-none absolute -inset-1"
      viewBox="0 0 300 56"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="qpPen">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" />
          <feDisplacementMap in="SourceGraphic" scale="3.5" />
        </filter>
      </defs>
      <motion.path
        d="M 12 28 C 14 8, 80 4, 150 6 C 230 8, 292 12, 290 28 C 288 46, 210 52, 130 51 C 60 50, 10 46, 12 30 C 13 22, 30 14, 60 10"
        fill="none"
        stroke="#b1512c"
        strokeWidth="2.5"
        strokeLinecap="round"
        filter="url(#qpPen)"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

function PencilCross() {
  const reduce = useReducedMotion();
  return (
    <svg
      className="pointer-events-none absolute -right-4 top-1/2 h-5 w-5 -translate-y-1/2"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <motion.path
        d="M 3 3 L 17 17 M 17 3 L 3 17"
        fill="none"
        stroke="#6c5d49"
        strokeWidth="1.8"
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
      />
    </svg>
  );
}

function Exam() {
  const [picked, setPicked] = useState<number | null>(null);
  const [announced, setAnnounced] = useState("");

  const choose = (i: number) => {
    setPicked(i);
    setAnnounced(i === QUIZ.answer ? "Correct" : "Not quite");
  };

  const reset = () => {
    setPicked(null);
    setAnnounced("");
  };

  const letters = ["a", "b", "c", "d"];

  return (
    <div
      id="exam-paper"
      tabIndex={0}
      onKeyDown={(e) => {
        if (picked === null) {
          const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
          if (n >= 0) {
            e.preventDefault();
            choose(n);
          }
        }
      }}
    >
    <StackedSheet tilt={1} className="p-7">
      <Tape at="tr" />
      <div className="flex items-baseline justify-between border-b border-dashed border-line-strong pb-3">
        <span className="kicker">mock exam · question 1</span>
        <span className="font-meta text-[10px] text-ink-faint">1 mark</span>
      </div>
      <p className="mt-5 font-display text-2xl leading-snug">
        {QUIZ.question}
      </p>
      <ol
        className="mt-5 flex flex-col gap-2.5"
        role="group"
        aria-label="Answer options"
      >
        {QUIZ.options.map((opt, i) => {
          const answered = picked !== null;
          const isCorrect = i === QUIZ.answer;
          const isPicked = picked === i;
          return (
            <li key={opt} className="relative">
              <button
                type="button"
                disabled={answered}
                onClick={() => choose(i)}
                className={`flex w-full items-baseline gap-3 border-l-2 px-4 py-2.5 text-left transition-colors duration-300 ease-out ${
                  !answered
                    ? "border-line hover:border-rust"
                    : isCorrect
                      ? "border-rust"
                      : isPicked
                        ? "border-ink-faint text-ink-faint"
                        : "border-line text-ink-faint"
                }`}
              >
                <span className="font-meta text-xs text-ink-faint">
                  {letters[i]})
                </span>
                <span className="font-medium">{opt}</span>
              </button>
              {answered && isCorrect && <TeacherCircle />}
              {answered && isPicked && !isCorrect && <PencilCross />}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status">
        {announced}
      </p>
      {picked !== null && (
        <Reveal>
          <div className="relative mt-5 border border-dashed border-rust-soft p-4">
            <span className="hand absolute -top-3.5 left-4 bg-card px-2 text-lg text-rust-deep">
              examiner's note
            </span>
            <p className="text-sm leading-relaxed text-ink-soft">{QUIZ.why}</p>
            <p className="mt-2 font-meta text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              {QUIZ.source}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium transition-colors duration-300 ease-out hover:border-rust hover:text-rust-deep"
          >
            try again
          </button>
        </Reveal>
      )}
    </StackedSheet>
    </div>
  );
}

export function Study() {
  return (
    <section id="study" aria-labelledby="study-title" className="py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          index="02"
          kicker="The study desk"
          titleId="study-title"
          title="Then it quizzes you, gently."
          lead="Notes are for reading. Exams are for recalling. Quillpad turns each note into both, inside the app."
          annotation="written from the seed chapters themselves"
        />
        <div className="mt-16 grid items-start gap-14 lg:grid-cols-[1fr_1.05fr]">
          <Reveal>
            <FlashDeck />
          </Reveal>
          <Reveal delay={0.08}>
            <Exam />
          </Reveal>
        </div>
        <div className="mt-16 grid gap-8 border-t border-dashed border-line-strong pt-10 sm:grid-cols-3">
          {[
            ["01", "flashcards", "spaced by what you miss, shuffled by what you knew"],
            ["02", "quiz me", "written from your own important questions first"],
            ["03", "mock exams", "timed full papers, marked in app"],
          ].map(([n, t, d], i) => (
            <Reveal key={t} delay={i * 0.06}>
              <div className="flex gap-4">
                <span className="font-display text-3xl italic leading-none text-rust">
                  {n}
                </span>
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
