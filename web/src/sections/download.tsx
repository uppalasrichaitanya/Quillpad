/** Plate 06 · Download: the note's closing recap card. Headline at the
 *  page's largest size on the left; on the right, the app's dashed recap
 *  sheet with a Caveat tab holds the real CTA, the stamped facts, and a
 *  tear-off checksum slip. */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DOWNLOAD, formatBytes } from "../download-info";
import { Button, QuillMark } from "../components/ui";
import { Reveal } from "../components/motion-primitives";
import { StackedSheet, Tape } from "../components/sheet";

function ChecksumSlip() {
  const [copied, setCopied] = useState(false);
  const resetRef = useRef<number | undefined>(undefined);

  // one owned timer: rapid copies must not reset early, and unmounting must
  // not schedule a state update on a gone component
  useEffect(() => () => window.clearTimeout(resetRef.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(DOWNLOAD.sha256);
      setCopied(true);
      window.clearTimeout(resetRef.current);
      resetRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard denied: label stays */
    }
  };

  return (
    <div className="relative mt-6">
      <div className="border border-dashed border-line-strong bg-paper px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-meta text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              sha-256
            </p>
            <p className="mt-1 break-all font-meta text-[11px] leading-relaxed text-ink-soft">
              {DOWNLOAD.sha256}
            </p>
          </div>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-full border border-line-strong px-3.5 py-1.5 text-xs font-medium transition-colors duration-300 ease-out hover:border-rust hover:text-rust-deep"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>
      <span
        className="hand absolute -bottom-4 right-2 rotate-2 text-lg text-ink-faint"
        aria-hidden="true"
      >
        tear-off
      </span>
      <p className="sr-only" role="status">
        {copied ? "Checksum copied to clipboard" : ""}
      </p>
    </div>
  );
}

export function Download() {
  const reduce = useReducedMotion();

  return (
    <section id="download" aria-labelledby="download-title" className="py-32">
      <div className="mx-auto grid max-w-6xl items-start gap-14 px-6 lg:grid-cols-[1.05fr_1fr]">
        {/* left: the headline */}
        <div>
          <p className="kicker">Plate 06 · get Quillpad</p>
          <h2
            id="download-title"
            className="mt-5 font-display leading-[0.96] tracking-[-0.01em]"
            style={{ fontSize: "clamp(3.2rem, 6.4vw, 6.2rem)" }}
          >
            The notebook closes.{" "}
            <em className="text-rust-deep">The knowing stays.</em>
          </h2>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-ink-soft">
            One portable exe for Windows 10 and 11. No installer, no account,
            no telemetry. Your notes folder is the only thing it touches.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 text-sm text-ink-faint">
            <span>{formatBytes(DOWNLOAD.sizeBytes)} exe</span>
            <span aria-hidden="true">·</span>
            <span>WebView2 preinstalled</span>
            <span aria-hidden="true">·</span>
            <span>runs from anywhere</span>
          </div>

          <div className="mt-12 flex flex-col gap-5 border-t border-dashed border-line-strong pt-8">
            {[
              ["01", "double-click", "the exe runs from anywhere; no install ritual"],
              ["02", "pick a folder", "point it at any folder, or one you already keep"],
              ["03", "import a chapter", "bring a PDF, let it distill, start reading in under a minute"],
            ].map(([n, t, d], i) => (
              <Reveal key={t} delay={i * 0.06}>
                <div className="flex gap-5">
                  <span className="font-display text-3xl italic leading-none text-rust">
                    {n}
                  </span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mt-10 max-w-md text-sm leading-relaxed text-ink-faint">
            the exe is unsigned; Windows SmartScreen may ask, More info then
            Run anyway. or build from source: npm run tauri dev. verify
            against the checksum on the right.
          </p>
        </div>

        {/* right: the recap card */}
        <div className="lg:pt-10">
          <StackedSheet tilt={1} className="p-8">
            <Tape at="tl" />
            <span className="hand absolute -top-5 left-6 rotate-[-2deg] text-3xl text-rust-deep">
              quick recap
            </span>
            <div className="pt-2">
              <p className="font-display text-3xl font-semibold leading-tight">
                Take it home.
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                v{DOWNLOAD.version} · {DOWNLOAD.fileName}
              </p>
              <motion.div
                whileHover={reduce ? undefined : { y: -2 }}
                transition={{ damping: 20, mass: 1, stiffness: 200 }}
                className="mt-7"
              >
                <Button
                  href={DOWNLOAD.href}
                  download={DOWNLOAD.fileName}
                  className="w-full px-8 py-5 text-lg"
                >
                  <QuillMark className="h-6 w-6 text-white" />
                  Download for Windows
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">
                    v{DOWNLOAD.version}
                  </span>
                </Button>
              </motion.div>
              <div className="mt-6 border-t border-dashed border-line-strong" />
              <ChecksumSlip />
            </div>
          </StackedSheet>
        </div>
      </div>
    </section>
  );
}
