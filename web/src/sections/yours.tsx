import { useEffect, useMemo, useState } from "react";
import { SIDEBAR_GROUPS } from "../content";
import { BIO04_FILE, BIO04_RAW } from "../note-source";
import { QuillMark, SectionHead } from "../components/ui";
import { Reveal } from "../components/motion-primitives";

/** The note file itself: raw source on disk vs the rendered note. */
function RawWindow() {
  const [raw, setRaw] = useState(true);
  return (
    <div className="sheet overflow-hidden">
      <div className="flex items-center justify-between border-b border-dashed border-line-strong px-5 py-3">
        <span className="font-meta text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {BIO04_FILE}
        </span>
        <span className="flex gap-1.5" role="group" aria-label="Source view">
          <button
            type="button"
            aria-pressed={raw}
            onClick={() => setRaw(true)}
            className={`rounded-full px-4 py-1.5 font-meta text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 ease-out ${
              raw
                ? "bg-rust text-white"
                : "border border-dashed border-line-strong text-ink-faint hover:border-rust hover:text-rust-deep"
            }`}
          >
            raw
          </button>
          <button
            type="button"
            aria-pressed={!raw}
            onClick={() => setRaw(false)}
            className={`rounded-full px-4 py-1.5 font-meta text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 ease-out ${
              !raw
                ? "bg-rust text-white"
                : "border border-dashed border-line-strong text-ink-faint hover:border-rust hover:text-rust-deep"
            }`}
          >
            rendered
          </button>
        </span>
      </div>
      {raw ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all px-5 py-4 font-meta text-[11px] leading-relaxed text-ink-soft">
          {BIO04_RAW}
        </pre>
      ) : (
        <div className="px-6 py-5" aria-label="Rendered note">
          <p className="kicker">Biology · 04</p>
          <h3 className="mt-2 font-display text-2xl font-semibold">
            Cell Structure &amp; Function
          </h3>
          <div className="mt-3 border-t border-dashed border-rust-soft" />
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Every organelle in the cell has one job and does it well. Think of
            the cell as a tiny factory&hellip;
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            <span className="font-medium text-rust-deep">Mitochondria</span>:
            site of aerobic respiration, produces ATP; has its own DNA
            (endosymbiotic origin).
          </p>
          <p className="hand mt-3 text-lg text-ink-faint">
            &#8230;and the diagram block redraws itself on every open
          </p>
        </div>
      )}
    </div>
  );
}

type Line =
  | { kind: "group"; subject: string }
  | { kind: "file"; subject: string; file: string; active: boolean };

function NotebookSidebar() {
  const [shown, setShown] = useState(0);

  const lines: Line[] = useMemo(
    () =>
      SIDEBAR_GROUPS.flatMap((g) => [
        { kind: "group", subject: g.subject } as Line,
        ...g.files.map(
          (f) =>
            ({
              kind: "file",
              subject: g.subject,
              file: f,
              active: f === g.active,
            }) as Line
        ),
      ]),
    []
  );

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduce) {
      setShown(lines.length);
      return;
    }
    if (shown >= lines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 300 : 280);
    return () => clearTimeout(t);
  }, [shown, lines]);

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-line bg-card-deep shadow-sm">
        {/* brand row, like the app's sidebar */}
        <div className="flex items-center gap-2 border-b border-dashed border-line-strong px-5 py-4">
          <QuillMark className="h-6 w-6 text-ink" />
          <span className="font-display text-lg font-semibold tracking-wide">
            Quillpad
          </span>
          <span className="ml-auto font-meta text-[10px] text-ink-faint">
            local files
          </span>
        </div>

        <div aria-hidden="true" className="px-5 py-4">
          {lines.slice(0, shown).map((l) =>
            l.kind === "group" ? (
              <p
                key={`g-${l.subject}`}
                className="mb-1.5 mt-4 font-meta text-[11px] uppercase tracking-[0.22em] text-ink-faint first:mt-0"
              >
                {l.subject}/
              </p>
            ) : (
              <div
                key={l.file}
                className={`-mx-2 mb-0.5 flex items-center gap-2 rounded-md border-l-2 py-1 pl-2.5 pr-2 text-sm ${
                  l.active
                    ? "border-rust bg-rust-tint font-medium text-rust-deep"
                    : "border-transparent text-ink-soft"
                }`}
              >
                <span className="truncate">{l.file}</span>
              </div>
            )
          )}
          {shown < lines.length && (
            <div className="h-5 w-40 animate-pulse rounded bg-line" />
          )}
        </div>

        <div aria-hidden="true" className="px-5 pb-5">
          <div className="rounded-lg border border-dashed border-line-strong bg-card px-3 py-2 text-center text-sm text-ink-faint">
            + import chapter pdf
          </div>
        </div>
      </div>

      {shown >= lines.length && (
        <button
          type="button"
          onClick={() => setShown(0)}
          className="mt-4 rounded-full border border-line-strong px-3.5 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-300 ease-out hover:border-rust hover:text-rust-deep"
        >
          replay filing
        </button>
      )}

      <p className="sr-only">
        Quillpad&apos;s sidebar: Biology with 01-intro-to-cell-biology.md,
        {BIO04_FILE} and 07-genetics-basics.md open;
        Chemistry with 02-periodic-trends.md; Physics with
        03-newtons-laws.md. The sidebar mirrors the notes folder on disk.
      </p>
    </div>
  );
}

export function Yours() {
  return (
    <section id="yours" aria-labelledby="yours-title" className="py-28">
      <SectionHead
        index="04"
        kicker="Your files"
        titleId="yours-title"
        title="A note is a file, not a row in a database."
        lead="Every note lives on your disk as plain Markdown, filed by subject and chapter. The sidebar mirrors the folder exactly. Open it in any editor, sync it with any folder sync, and it outlives any app."
        annotation="no cloud, no account, nothing to leak"
      />
      <div className="mx-auto mt-16 grid max-w-5xl items-start gap-12 px-6 lg:grid-cols-2">
        <div className="min-w-0">
          <NotebookSidebar />
        </div>
        <div className="min-w-0">
          <RawWindow />
          {[
            [
              "1",
              "local-first",
              "no account, no cloud, no telemetry; the app opens your folder and nothing phones home",
            ],
            [
              "2",
              "plain markdown",
              "YAML front-matter and sections a human reads; diagrams are typed specs in fenced blocks so prose stays prose",
            ],
            [
              "3",
              "yours, actually",
              "back the folder up, grep it, script it, print it; your notes outlive the app",
            ],
          ].map(([n, t, d], i) => (
            <Reveal key={t} delay={i * 0.08}>
              <div className="border-t border-dashed border-line-strong py-6">
                <span className="font-display text-2xl italic text-rust">
                  {n}
                </span>
                <p className="mt-2 font-medium">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {d}
                </p>
              </div>
            </Reveal>
          ))}
          <p className="border-t border-dashed border-line-strong pt-6 text-sm text-ink-faint">
            built with Tauri 2: a Rust core in a 15 MB exe
          </p>
        </div>
      </div>
    </section>
  );
}
