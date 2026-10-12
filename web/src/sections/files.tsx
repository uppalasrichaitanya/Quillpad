import { useState } from "react";
import { Paper } from "../components/paper";
import { SEED_NOTES } from "../seed";

const NOTE = SEED_NOTES[1];
const SUBJECTS = [...new Set(SEED_NOTES.map((n) => n.subject))];

const RAW = `---
subject: ${NOTE.subject}
num: "${NOTE.num}"
title: ${NOTE.title}
created: 2026-08-31
---

## Summary

${NOTE.summary}

## Key points

${NOTE.points
  .slice(0, 3)
  .map((p) => `- **${p.lead}** — ${p.rest}`)
  .join("\n")}`;

export function Files() {
  const [raw, setRaw] = useState(true);
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
      <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <h2 className="text-[clamp(2.1rem,4.2vw,3.4rem)] leading-[1.06] text-cream">Your notes are just files.</h2>
          <p className="mt-6 max-w-lg text-[1.125rem] text-cream-soft">
            Every note is a Markdown file in a folder you choose, one folder per subject. Open them in any editor, back
            them up however you like, and keep them long after you stop using the app.
          </p>
          <p className="mt-4 max-w-lg text-[1.125rem] text-cream-soft">
            Need to share one? Export a chapter as Markdown, a styled web page or a PDF — or a one-page cheat sheet for a
            whole subject.
          </p>
          <ul className="mt-9 space-y-3 text-[1.0625rem] text-cream">
            {[
              ["No account.", "Nothing to sign up for."],
              ["No cloud.", "Notes never leave your computer."],
              ["Your key, your machine.", "AI requests go straight from the app to Anthropic."],
            ].map(([a, b]) => (
              <li key={a} className="flex gap-3">
                <span className="mt-[11px] h-px w-5 shrink-0 bg-rust-bright" />
                <span>
                  <strong className="font-semibold">{a}</strong> <span className="text-cream-soft">{b}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-6 sm:grid-cols-[215px_1fr] sm:items-start">
          <div className="rounded-lg border border-desk-line bg-desk-raised p-4 font-mono text-[11.5px] leading-[1.9] overflow-x-auto text-cream-soft">
            <div className="text-cream">Quillpad/</div>
            {SUBJECTS.map((s) => (
              <div key={s} className="pl-3">
                <div className="text-cream">{s}/</div>
                {SEED_NOTES.filter((n) => n.subject === s).map((n) => (
                  <div key={n.file} className={`whitespace-nowrap pl-3 ${n === NOTE ? "text-rust-bright" : ""}`}>
                    {n.file}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <Paper className="min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-ink/25 px-5 py-3">
              <span className="truncate font-mono text-[11px] text-ink-soft">{NOTE.file}</span>
              <div className="flex shrink-0 rounded-full border border-ink/20 p-0.5 text-[12px]" role="group" aria-label="View">
                {(["Raw", "Rendered"] as const).map((l) => {
                  const on = (l === "Raw") === raw;
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setRaw(l === "Raw")}
                      className={`rounded-full px-3 py-0.5 transition-colors ${on ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
            {raw ? (
              <pre className="h-[340px] overflow-auto px-5 py-4 font-mono text-[11.5px] leading-[1.7] whitespace-pre-wrap text-ink">
                {RAW}
              </pre>
            ) : (
              <div className="h-[340px] overflow-auto px-5 py-4">
                <div className="font-display text-[22px] font-semibold">{NOTE.title}</div>
                <div className="mt-3 text-[11px] font-semibold tracking-wide text-ink-soft">Summary</div>
                <p className="mt-1 text-[13.5px] leading-[1.55]">{NOTE.summary}</p>
                <div className="mt-3 text-[11px] font-semibold tracking-wide text-ink-soft">Key points</div>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[13.5px] leading-[1.5]">
                  {NOTE.points.slice(0, 3).map((p) => (
                    <li key={p.lead}>
                      <strong>{p.lead}</strong> — {p.rest}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Paper>
        </div>
      </div>
    </section>
  );
}
