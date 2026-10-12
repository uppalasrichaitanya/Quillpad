import { motion, stagger, useAnimate, useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useState, type CSSProperties, type PointerEvent } from "react";
import { SEED_NOTES } from "../seed";
import { CellDiagram, type DrawMode } from "./cell-diagram";
import { NoteEyebrow } from "./paper";

const NOTE = SEED_NOTES[1]; // Biology 04 — Cell Structure & Function
const POINTS = NOTE.points.slice(0, 3); // Nucleus, Mitochondria, Ribosomes
const SOFT = [0.22, 1, 0.36, 1] as const; // a slow, settling ease-out
const INK_EASE = [0.16, 1, 0.3, 1] as const; // the diagram's own stroke ease

// paper in the air vs paper lying on the desk
const SHADOW_LIFTED =
  "0 2px 3px rgb(0 0 0 / 0.12), 0 22px 34px -8px rgb(0 0 0 / 0.32), 0 70px 90px -24px rgb(0 0 0 / 0.5)";
const SHADOW_LANDED =
  "0 1px 1px rgb(0 0 0 / 0.35), 0 3px 6px -1px rgb(0 0 0 / 0.35), 0 22px 40px -14px rgb(0 0 0 / 0.6)";

// ---------- the source: a real-looking textbook page ----------

/**
 * A sentence the quill underlines. The wash and the ink rule grow with
 * --sweep; as one continuous background they run line by line, like a pen.
 */
function Key({ i, full, children }: { i: number; full: boolean; children: string }) {
  return (
    <span
      data-key={i}
      className="text-[#3e352a]"
      style={
        {
          "--sweep": full ? "100%" : undefined,
          backgroundImage: "linear-gradient(rgb(188 90 50 / 0.15), rgb(188 90 50 / 0.15)), linear-gradient(#bc5a32, #bc5a32)",
          backgroundPosition: "0 0, 0 100%",
          backgroundRepeat: "no-repeat",
          backgroundSize: "var(--sweep, 0%) 100%, var(--sweep, 0%) 1.5px",
          paddingBottom: 1,
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}

function TextbookPage({ underlined }: { underlined: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="h-full overflow-hidden rounded-[2px] bg-[#ebe6dc] px-[7%] pt-[6%] font-body text-[8px] leading-[1.55] text-[#6f685c] sm:text-[9px]"
      style={{
        backgroundImage:
          "linear-gradient(100deg, rgb(255 255 255 / 0.4), transparent 45%), linear-gradient(180deg, transparent 80%, rgb(0 0 0 / 0.05))",
      }}
    >
      <div className="mb-[5%] flex justify-between border-b border-[#cfc8bb] pb-1 font-mono text-[7px] tracking-[0.14em] text-[#958d80] sm:text-[8px]">
        <span>CHAPTER 4 · THE CELL</span>
        <span>112</span>
      </div>
      <div className="mb-1.5 font-display text-[11px] font-semibold text-[#4a4237] sm:text-[12.5px]">4.2 The eukaryotic cell</div>
      <p className="hyphens-auto text-justify">
        Every eukaryotic cell is divided into compartments by internal membranes, and each compartment carries out a
        distinct set of chemical reactions. The largest of these is the nucleus:{" "}
        <Key i={0} full={underlined}>the nucleus houses the cell’s DNA and directs gene expression</Key>, sending messenger RNA
        out through pores in the nuclear envelope.
      </p>
      <p className="mt-1.5 hyphens-auto indent-3 text-justify">
        Energy for this work comes chiefly from the mitochondria. Bounded by a double membrane whose inner surface is
        folded into cristae, <Key i={1} full={underlined}>mitochondria release energy as ATP through aerobic respiration</Key>;
        they also keep a small circular genome of their own, a remnant of their bacterial ancestry.
      </p>
      <figure className="my-[5%]">
        <div
          className="aspect-[16/7] w-full rounded-[1px] border border-[#cdc6b9]"
          style={{
            background:
              "radial-gradient(circle at 46% 48%, #a39a8b 0 11%, #c9c1b3 12% 19%, transparent 20%), radial-gradient(ellipse 18% 10% at 72% 66%, #b3aa9b 40%, transparent 42%), radial-gradient(ellipse 14% 8% at 24% 30%, #b8af9f 40%, transparent 42%), radial-gradient(ellipse 60% 70% at 50% 50%, #d9d2c5, #cfc7b9)",
          }}
        />
        <figcaption className="mt-1 font-mono text-[6.5px] tracking-[0.06em] text-[#958d80] sm:text-[7.5px]">
          FIG. 4.1 — Animal cell, transmission electron micrograph (×12 000)
        </figcaption>
      </figure>
      <p className="hyphens-auto text-justify">
        Proteins are built in the cytoplasm and along the rough endoplasmic reticulum, where{" "}
        <Key i={2} full={underlined}>ribosomes read mRNA and assemble it into protein</Key>. The Golgi apparatus then modifies,
        sorts and packages these products for export, while the plasma membrane governs what enters and leaves.
      </p>
      <p className="mt-1.5 hyphens-auto indent-3 text-justify">
        Cells vary enormously in shape and size, yet the same small set of organelles recurs across plants, animals and
        fungi — which is why the cell remains the basic unit of structure and function in living things. In the
        sections that follow we take each organelle in turn, beginning with the nucleus and the control of gene
        expression, before turning to the membranes that divide the cell into its working parts.
      </p>
    </div>
  );
}

// ---------- the result: the distilled note ----------

function NoteSheet({ mode, settled }: { mode: DrawMode; settled: boolean }) {
  const before = (style: CSSProperties) => (settled ? undefined : style);
  return (
    <div className="paper relative rounded-[3px] px-6 pt-7 pb-4 !shadow-none sm:px-8 sm:pt-8">
      <span className="tape -top-3 left-8 -rotate-6" aria-hidden="true" />
      <span className="tape -top-3 right-8 rotate-[5deg]" aria-hidden="true" />
      <div data-line style={before({ opacity: 0 })}>
        <NoteEyebrow>
          {NOTE.subject} · Chapter {NOTE.num}
        </NoteEyebrow>
      </div>
      <div
        data-line
        data-testid="hero-note-title"
        className="mt-2 font-display text-[24px] leading-[1.1] font-semibold text-ink sm:text-[28px]"
        style={before({ opacity: 0 })}
      >
        {NOTE.title}
      </div>
      <div data-rule className="my-4 origin-left border-t border-dashed border-ink/30" style={before({ transform: "scaleX(0)" })} />
      <p data-line className="text-[14px] leading-[1.55] text-ink sm:text-[14.5px]" style={before({ opacity: 0 })}>
        {NOTE.summary}
      </p>
      <ul className="mt-4 space-y-2 text-[13.5px] leading-[1.45] text-ink">
        {POINTS.map((p, i) => (
          <li key={p.lead} data-point={i} className="flex gap-2.5" style={before({ opacity: 0 })}>
            <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-rust" />
            <span>
              <strong className="font-semibold">{p.lead}</strong> — {p.rest}
            </span>
          </li>
        ))}
      </ul>
      <div data-diagram className="mx-auto mt-1 w-[86%]">
        <CellDiagram mode={mode} className="w-full" />
      </div>
    </div>
  );
}

// ---------- the quill nib that reads and draws ----------

/** The nib's tip sits on this element's (0,0). */
function Nib() {
  return (
    <div data-nib className="pointer-events-none absolute top-0 left-0 z-40" style={{ opacity: 0 }} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="absolute -top-[47px] -left-[1px] h-12 w-12 drop-shadow-[0_8px_6px_rgb(0_0_0/0.35)]">
        <path d="M2 62 L14 40 Q30 14 60 2 Q50 30 24 50 Z" fill="#f1e7d6" stroke="#362b1e" strokeWidth="2" strokeLinejoin="round" />
        <path d="M5 57 L30 30" stroke="#362b1e" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 62 L9 49 L14 54 Z" fill="#bc5a32" />
      </svg>
    </div>
  );
}

// ---------- the orchestration ----------

type Phase = "idle" | "running" | "done";
const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

/**
 * The page's one orchestrated moment. A textbook page lands on the desk; a
 * quill reads it, underlining the three sentences that matter; those lines
 * lift off the page and become the key points of the Quillpad note rising in
 * front; the quill draws the figure and lifts away. Plays once when seen.
 */
export function DistillSequence() {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const seen = useInView(scope, { once: true, amount: 0.45 });
  // read the motion preference only after mount, so the pre-rendered HTML and
  // the first client render agree
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduce = mounted && Boolean(prefersReduced);

  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [diagram, setDiagram] = useState<DrawMode>("hidden");

  useEffect(() => {
    if (reduce) {
      setDiagram("instant");
      setPhase("done");
    }
  }, [reduce]);

  useEffect(() => {
    if (!seen || reduce) return;
    let cancelled = false;
    setDiagram("hidden");
    setPhase("running");
    play().then((finished) => {
      if (finished && !cancelled) setPhase("done");
    });
    return () => {
      cancelled = true;
    };

    async function play(): Promise<boolean> {
      const root = scope.current;
      if (!root) return false;
      const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
      const qa = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
      const page = q("[data-page]");
      const note = q("[data-note-wrap]");
      const nib = q("[data-nib]");
      const local = (r: DOMRect) => {
        const b = root.getBoundingClientRect();
        return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, right: r.right - b.left, bottom: r.bottom - b.top };
      };

      // 1 · the page lands: it falls the last few centimetres, its shadow
      //     tightening as it meets the desk
      await animate(
        page,
        { opacity: [0, 1], y: [-44, 0], rotate: [9, 5], scale: [1.05, 1], boxShadow: [SHADOW_LIFTED, SHADOW_LANDED] },
        { duration: 1, ease: SOFT },
      );
      if (cancelled) return false;
      await wait(0.15);

      // 2 · the quill reads the page, underlining each sentence that matters
      const keys = qa("[data-key]");
      for (const [i, key] of keys.entries()) {
        const lines = [...key.getClientRects()].map(local).filter((l) => l.w > 2);
        if (!lines.length) continue;
        const total = lines.reduce((s, l) => s + l.w, 0);
        const sweep = Math.min(0.8, 0.3 + total / 560);
        await animate(
          nib,
          { x: lines[0].x, y: lines[0].bottom, opacity: 1, rotate: 0 },
          { duration: i === 0 ? 0.5 : 0.32, ease: SOFT },
        );
        const xs: number[] = [];
        const ys: number[] = [];
        const times: number[] = [];
        let done = 0;
        for (const l of lines) {
          xs.push(l.x, l.right);
          ys.push(l.bottom, l.bottom);
          times.push(done / total, (done + l.w) / total);
          done += l.w;
        }
        await Promise.all([
          animate(nib, { x: xs, y: ys }, { duration: sweep, ease: "linear", times }),
          animate(key, { "--sweep": ["0%", "100%"] } as never, { duration: sweep, ease: "linear" }),
        ]);
        if (cancelled) return false;
      }
      animate(nib, { y: "-=28", opacity: 0, rotate: -8 }, { duration: 0.35, ease: "easeIn" });
      await wait(0.1);

      // 3 · the note rises in front while the source page sinks back
      animate(page, { opacity: 0.5, scale: 0.955, y: -8, rotate: 6 }, { duration: 0.95, ease: SOFT });
      await animate(
        note,
        { opacity: [0, 1], y: [110, 0], rotate: [-5, -1.5], boxShadow: [SHADOW_LIFTED, SHADOW_LANDED] },
        { duration: 0.9, ease: SOFT },
      );
      if (cancelled) return false;
      animate(qa("[data-line]"), { opacity: [0, 1], y: [6, 0] }, { duration: 0.5, ease: SOFT, delay: stagger(0.09) });
      animate(q("[data-rule]"), { scaleX: [0, 1] }, { duration: 0.7, ease: SOFT, delay: 0.12 });
      await wait(0.35);

      // 4 · the underlined sentences lift off the page and land as key points
      const points = qa("[data-point]");
      const flights = keys.map(async (key, i) => {
        const target = points[i];
        if (!target) return;
        await wait(i * 0.16);
        const from = local(key.getClientRects()[0]);
        const to = local(target.getBoundingClientRect());
        const style = getComputedStyle(key);
        const ghost = document.createElement("div");
        ghost.textContent = key.textContent;
        ghost.setAttribute("aria-hidden", "true");
        Object.assign(ghost.style, {
          position: "absolute",
          left: "0",
          top: "0",
          zIndex: "30",
          whiteSpace: "nowrap",
          font: style.font,
          color: "#a04a27",
          pointerEvents: "none",
          transformOrigin: "0 0",
        });
        root.appendChild(ghost);
        const grow = (13.5 / parseFloat(style.fontSize)) * 0.8;
        animate(target, { opacity: [0, 1], x: [-6, 0] }, { duration: 0.45, ease: SOFT, delay: 0.5 });
        await animate(
          ghost,
          {
            x: [from.x, from.x + 12, to.x + 14],
            y: [from.y, from.y - 26, to.y + 1],
            scale: [1, 1.1, grow],
            rotate: [5, 1, -1.5],
            opacity: [1, 1, 0],
          },
          { duration: 0.8, ease: SOFT, times: [0, 0.32, 1] },
        );
        ghost.remove();
      });
      await Promise.all(flights);
      if (cancelled) return false;

      // 5 · the quill traces the cell's outline as it inks in, then lifts away
      const d = local(q("[data-diagram] svg").getBoundingClientRect());
      const sx = d.w / 400;
      const sy = d.h / 310;
      const ex: number[] = [];
      const ey: number[] = [];
      for (let k = 0; k <= 40; k++) {
        const t = (k / 40) * Math.PI * 2;
        ex.push(d.x + (200 + 118 * Math.cos(t)) * sx);
        ey.push(d.y + (160 + 98 * Math.sin(t)) * sy);
      }
      await animate(nib, { x: ex[0] + 18, y: ey[0] - 34, rotate: 10 }, { duration: 0 });
      await animate(nib, { x: ex[0], y: ey[0], opacity: 1, rotate: 0 }, { duration: 0.35, ease: SOFT });
      setDiagram("draw");
      await animate(nib, { x: ex, y: ey }, { duration: 0.9, ease: INK_EASE });
      await animate(nib, { x: "+=34", y: "-=44", opacity: 0, rotate: 14 }, { duration: 0.5, ease: "easeIn" });
      await wait(0.7);
      return !cancelled;
    }
  }, [seen, reduce, run, animate, scope]);

  // a whisper of tilt toward the pointer, once everything has settled
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const tiltX = useSpring(rx, { stiffness: 110, damping: 20 });
  const tiltY = useSpring(ry, { stiffness: 110, damping: 20 });
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== "done" || reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 5);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 4);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  const done = phase === "done";
  return (
    <div className="relative" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="[perspective:1400px]">
        <motion.div
          ref={scope}
          key={run}
          style={{ rotateX: tiltX, rotateY: tiltY }}
          className="relative mx-auto w-full max-w-[460px] pt-4 pl-4 sm:pl-8"
          role="img"
          aria-label={`A textbook page whose key sentences become the Quillpad note “${NOTE.title}”`}
        >
          <div
            data-page
            className="absolute top-0 bottom-6 left-0 w-[86%] rounded-[2px]"
            style={
              done
                ? { opacity: 0.5, transform: "translateY(-8px) rotate(6deg) scale(0.955)", boxShadow: SHADOW_LANDED }
                : { opacity: 0 }
            }
          >
            <TextbookPage underlined={reduce} />
          </div>
          <div
            data-note-wrap
            className="relative z-10 ml-auto w-[94%] rounded-[3px]"
            style={done ? { opacity: 1, transform: "rotate(-1.5deg)", boxShadow: SHADOW_LANDED } : { opacity: 0 }}
          >
            <NoteSheet mode={diagram} settled={done} />
          </div>
          <Nib />
        </motion.div>
      </div>

      {!reduce && (
        <button
          type="button"
          onClick={() => {
            setPhase("idle");
            setRun((n) => n + 1);
          }}
          disabled={phase !== "done"}
          className="mt-6 block w-full text-center text-sm text-cream-soft underline decoration-cream-soft/40 underline-offset-4 transition-[color,opacity] duration-500 hover:text-cream disabled:pointer-events-none disabled:opacity-0"
        >
          Play it again
        </button>
      )}
    </div>
  );
}
