import { useInView } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CellDiagram } from "../components/cell-diagram";
import { NoteEyebrow, Paper } from "../components/paper";
import { SEED_NOTES } from "../seed";

// ---------- offline ask: the same idea as the app's matcher, at toy scale ----------

const STOP = new Set("a an the of to in on is are what why how do does did and or for with about i my me".split(" "));
const termsOf = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => t.replace(/(es|s)$/, ""));

function search(q: string) {
  const qt = termsOf(q);
  if (!qt.length) return null;
  let best: { score: number; note: (typeof SEED_NOTES)[number]; line: string } | null = null;
  for (const note of SEED_NOTES) {
    const lines = [note.title, note.summary, ...note.points.map((p) => `${p.lead} — ${p.rest}`)];
    for (const line of lines) {
      const lt = new Set(termsOf(line));
      const score = qt.filter((t) => lt.has(t) || [...lt].some((l) => l.startsWith(t) || t.startsWith(l))).length;
      if (score && (!best || score > best.score)) best = { score, note, line };
    }
  }
  return best;
}

const SUGGESTIONS = ["why do mitochondria have DNA", "what increases across a period", "Newton's third law"];

function MiniAsk() {
  const [q, setQ] = useState("");
  const hit = useMemo(() => search(q), [q]);
  return (
    <Paper className="p-6 sm:p-7">
      <label htmlFor="mini-ask" className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
        Ask your notes · offline
      </label>
      <input
        id="mini-ask"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. what does the Golgi do?"
        autoComplete="off"
        className="mt-2 w-full rounded-md border border-ink/20 bg-paper px-3.5 py-2.5 text-[16px] text-ink placeholder:text-ink-soft/80 focus:border-rust focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQ(s)}
            className="rounded-full border border-ink/20 px-3 py-1 text-[13px] text-ink-soft transition-colors hover:border-rust hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mt-4 min-h-[86px] border-t border-dashed border-ink/25 pt-3" aria-live="polite" data-testid="ask-result">
        {hit ? (
          <>
            <NoteEyebrow>
              {hit.note.subject} · Chapter {hit.note.num} · {hit.note.title}
            </NoteEyebrow>
            <p className="mt-1.5 text-[14.5px] leading-[1.5] text-ink">{hit.line}</p>
          </>
        ) : (
          <p className="text-[14.5px] text-ink-soft">
            {q.trim() ? "Nothing in these sample notes about that yet." : "Type a question or tap one above."}
          </p>
        )}
      </div>
    </Paper>
  );
}

// ---------- flashcard ----------

const CARDS = SEED_NOTES.flatMap((n) => n.points.filter((p) => p.lead).slice(0, 1).map((p) => ({ ...p, note: n })));

function MiniFlashcard() {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = CARDS[i % CARDS.length];
  const flip = () => setFlipped((f) => !f);
  return (
    <div>
      <button
        type="button"
        onClick={flip}
        onKeyDown={(e) => {
          if (e.key === " ") {
            e.preventDefault();
            flip();
          }
        }}
        aria-pressed={flipped}
        data-testid="flashcard"
        data-flipped={flipped}
        className="group block w-full rotate-[1.2deg] [perspective:1200px]"
      >
        <div
          className="relative h-[230px] transition-transform duration-500 [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          <Paper className="absolute inset-0 flex flex-col p-6 text-left [backface-visibility:hidden]">
            <NoteEyebrow>
              Card {(i % CARDS.length) + 1} of {CARDS.length} · {card.note.subject}
            </NoteEyebrow>
            <div className="mt-auto mb-auto font-display text-[24px] leading-snug font-semibold">
              What is the key idea of “{card.lead}”?
            </div>
            <div className="text-[13px] text-ink-soft">Tap or press space to flip</div>
          </Paper>
          <Paper className="absolute inset-0 flex flex-col p-6 text-left [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <NoteEyebrow>Answer</NoteEyebrow>
            <div className="mt-auto mb-auto text-[17px] leading-[1.5]">
              <strong className="font-semibold">{card.lead}</strong> — {card.rest}
            </div>
            <div className="text-[13px] text-ink-soft">
              {card.note.subject} · Chapter {card.note.num}
            </div>
          </Paper>
        </div>
      </button>
      <div className="mt-5 flex justify-center gap-3 text-[14px]">
        {["Missed it", "Got it"].map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setFlipped(false);
              setI((n) => n + 1);
            }}
            className="rounded-full border border-desk-line px-4 py-1.5 text-cream-soft transition-colors hover:border-cream-soft hover:text-cream"
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- exam clock ----------

function MiniExam() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const [left, setLeft] = useState(20 * 60);
  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 20 * 60)), 1000);
    return () => clearInterval(t);
  }, [inView]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div ref={ref}>
      <Paper className="p-6" tilt={-1}>
        <div className="flex items-baseline justify-between">
          <NoteEyebrow>Mock exam · Biology</NoteEyebrow>
          <span className="font-mono text-[15px] text-rust-deep tabular-nums" aria-label={`${mm} minutes ${ss} seconds left`}>
            {mm}:{ss}
          </span>
        </div>
        <div className="mt-4 font-display text-[18px] leading-snug font-semibold">
          Q3. A cell makes plenty of mRNA but almost no protein. Which organelle is the likeliest fault, and why?
        </div>
        <div className="mt-4 space-y-2" aria-hidden="true">
          {[100, 92, 97, 60].map((w, i) => (
            <div key={i} className="border-b border-ink/15 pb-2" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="mt-3 text-right text-[12.5px] text-ink-soft">5 marks</div>
      </Paper>
    </div>
  );
}

// ---------- midnight ink ----------

function MiniTheme() {
  const [dark, setDark] = useState(true);
  const n = SEED_NOTES[3];
  return (
    <div>
      <div
        className={`rounded-[3px] p-6 shadow-[var(--shadow-paper)] transition-colors duration-500 ${
          dark ? "bg-[#1d1813] text-[#e9dcc4]" : "paper"
        }`}
      >
        <div className={`font-mono text-[10.5px] tracking-[0.14em] uppercase ${dark ? "text-[#d0744a]" : "text-rust-deep"}`}>
          {n.subject} · Chapter {n.num}
        </div>
        <div className="mt-1.5 font-display text-[21px] font-semibold">{n.title}</div>
        <p className={`mt-2 text-[14px] leading-[1.5] ${dark ? "text-[#c9b99c]" : "text-ink-soft"}`}>{n.recap}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        onClick={() => setDark((d) => !d)}
        className="mt-4 flex items-center gap-3 text-[14px] text-cream-soft"
      >
        <span className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors ${dark ? "bg-rust-deep" : "bg-desk-line"}`}>
          <span className={`absolute top-1 left-0 block size-4 rounded-full bg-paper transition-transform ${dark ? "translate-x-6" : "translate-x-1"}`} />
        </span>
        {dark ? "Midnight Ink" : "Daylight paper"}
      </button>
    </div>
  );
}

// ---------- layout ----------

function Feature({ title, children, caption, className = "" }: { title: string; caption: string; children: ReactNode; className?: string }) {
  return (
    <figure className={className}>
      {children}
      <figcaption className="mt-6 max-w-md">
        <h3 className="text-[22px] leading-[1.2] text-cream">{title}</h3>
        <p className="mt-1.5 text-[16px] leading-[1.6] text-cream-soft">{caption}</p>
      </figcaption>
    </figure>
  );
}

export function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 lg:py-24">
      <h2 className="max-w-2xl text-[clamp(2.1rem,4.2vw,3.4rem)] leading-[1.06] text-cream">
        Everything a revision week needs, on one desk.
      </h2>
      <p className="mt-5 max-w-xl text-[1.125rem] text-cream-soft">
        These work right here with the sample notes the app ships with. Try them.
      </p>

      <div className="mt-16 grid gap-x-12 gap-y-20 lg:grid-cols-12">
        <Feature
          className="lg:col-span-7"
          title="Ask your notes, even offline"
          caption="Type a question and Quillpad points to the chapter and line that answers it. With a key, it can also write a full answer from your notes."
        >
          <MiniAsk />
        </Feature>
        <Feature
          className="lg:col-span-5 lg:pt-16"
          title="Flashcards that remember what you missed"
          caption="Every note becomes a deck. Cards you miss come back sooner; the ones you know step aside."
        >
          <MiniFlashcard />
        </Feature>
        <Feature
          className="lg:col-span-5"
          title="Timed mock exams"
          caption="Pick subjects and a length. Questions come from the ones you flagged first, then from your notes. Marked when you hand it in."
        >
          <MiniExam />
        </Feature>
        <Feature
          className="lg:col-span-4 lg:pt-10"
          title="Diagrams, redrawn by hand"
          caption="Figures in the chapter come back as clean line drawings with labels — not blurry screenshots."
        >
          <Paper className="p-5" tilt={1.5}>
            <CellDiagram className="w-full" />
            <div className="mt-1 font-mono text-[10px] text-ink-soft">fig. 4.1 — generalised animal cell</div>
          </Paper>
        </Feature>
        <Feature
          className="lg:col-span-3 lg:pt-24"
          title="Midnight Ink"
          caption="A dark theme for late nights, with diagrams that switch colours too."
        >
          <MiniTheme />
        </Feature>
      </div>
    </section>
  );
}
