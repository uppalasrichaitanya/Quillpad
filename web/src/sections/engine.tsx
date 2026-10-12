/** Plate 05 · The engine, wearing the app's midnight-ink mode: one dark
 *  band mid-page. Pipeline as a horizontal node rail with a dashed
 *  connector; the provider chain as pulsing dots. */

import { motion, useReducedMotion } from "motion/react";
import { ENGINE_CHAIN } from "../content";

const CHAIN = [
  { host: "seekai.cc", role: "primary text distill" },
  { host: "gorouter.app", role: "vision + fallback" },
  { host: "your key", role: "settings override" },
];

function PulseDot({ i }: { i: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative flex h-2 w-2">
      {!reduce && (
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-night-rust"
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: 0, scale: 2.4 }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            delay: i * 0.4,
            ease: "easeOut",
          }}
        />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full bg-night-rust" />
    </span>
  );
}

export function Engine() {
  const reduce = useReducedMotion();

  return (
    <section
      id="engine"
      aria-labelledby="engine-title"
      className="bg-night py-28 text-night-ink"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-2xl italic text-night-rust">05</span>
          <p className="font-meta text-xs uppercase tracking-[0.22em] text-night-rust">
            The engine
          </p>
          <span
            aria-hidden="true"
            className="h-px flex-1 border-t border-dashed border-night-line"
          />
        </div>
        <h2
          id="engine-title"
          className="mt-5 font-display text-mega font-semibold leading-[1.02] tracking-tight"
        >
          Four moves, end to end.
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-night-soft">
          Extract, distill, render, file. Scanned pages go to a vision model,
          text pages never leave the parser, and if one endpoint stumbles the
          next carries the chapter.
        </p>
        <p aria-hidden="true" className="hand mt-2 text-2xl text-night-soft">
          (this band is the app's own dark mode)
        </p>

        <div className="relative mt-16 hidden md:block">
          <div className="absolute left-[10%] right-[10%] top-6 border-t border-dashed border-night-line" />
          <div className="relative grid grid-cols-4 gap-6">
            {ENGINE_CHAIN.map((s) => (
              <div key={s.stage} className="flex flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-night-line bg-night-deep font-meta text-sm text-night-rust">
                  {s.stage}
                </span>
                <p className="mt-4 font-display text-2xl font-semibold">{s.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-night-soft">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
        <ol className="mt-14 flex flex-col gap-8 md:hidden">
          {ENGINE_CHAIN.map((s) => (
            <li key={s.stage} className="border-l border-dashed border-night-line pl-5">
              <p className="font-meta text-sm text-night-rust">{s.stage}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{s.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-night-soft">{s.detail}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 border-t border-dashed border-night-line pt-8">
          <p className="font-meta text-[11px] uppercase tracking-[0.22em] text-night-soft">
            the failover chain
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {CHAIN.map((c, i) => (
              <span key={c.host} className="flex flex-wrap items-center gap-3">
                {i > 0 && (
                  <span aria-hidden="true" className="text-night-soft">→</span>
                )}
                <motion.span
                  initial={reduce ? undefined : { opacity: 0.55 }}
                  whileInView={reduce ? undefined : { opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                  className="flex items-center gap-2.5 rounded-full border border-night-line bg-night-deep px-4 py-2"
                >
                  <PulseDot i={i} />
                  <span className="font-meta text-sm text-night-ink">{c.host}</span>
                  <span className="font-meta text-[10px] uppercase tracking-[0.14em] text-night-soft">
                    {c.role}
                  </span>
                </motion.span>
              </span>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-night-soft">
            keys stay in your .env on your machine. and offline, the app
            still opens, edits, searches and exports every note; only
            distillation needs the network.
          </p>
        </div>
      </div>
    </section>
  );
}
