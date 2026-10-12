/** Plate 03 · Ask your notes: the app's ask bar on a desk strip; matches
 *  arrive as paper slips with subject tabs; suggestions are pencil notes
 *  with a hand-drawn arrow into the bar. */

import { useMemo, useState } from "react";
import { SEARCH_DEMO } from "../content";
import { SectionHead } from "../components/ui";
import { Reveal } from "../components/motion-primitives";

const STOP = new Set([
  "the", "and", "what", "why", "how", "did", "does", "do", "is", "are",
  "was", "were", "a", "an", "of", "in", "on", "to", "for", "with", "own",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

type Result = (typeof SEARCH_DEMO)[number] & { score: number };

function rank(query: string): Result[] {
  const q = tokenize(query);
  if (q.length === 0) return [];
  return SEARCH_DEMO.map((item) => {
    const hitTokens = new Set(tokenize(item.hit));
    const qTokens = new Set(tokenize(item.q));
    const sTokens = new Set(tokenize(item.snippet));
    let score = 0;
    for (const t of q) {
      if (qTokens.has(t)) score += 2;
      if (hitTokens.has(t)) score += 2;
      if (sTokens.has(t)) score += 1;
    }
    return { ...item, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function SuggestionArrow() {
  return (
    <svg
      className="h-14 w-10 shrink-0 text-ink-faint"
      viewBox="0 0 40 56"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="qpPencil">
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="9" />
          <feDisplacementMap in="SourceGraphic" scale="2.5" />
        </filter>
      </defs>
      <path
        d="M 20 4 C 8 20, 8 36, 22 48 M 22 48 L 14 40 M 22 48 L 28 39"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        filter="url(#qpPencil)"
      />
    </svg>
  );
}

export function Ask() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => rank(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <section
      id="ask-demo"
      aria-labelledby="ask-title"
      className="border-y border-dashed border-line-strong bg-shell py-28"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHead
          index="03"
          kicker="Ask your notes"
          titleId="ask-title"
          title="Every note you keep, searchable in one line."
          lead="The offline matcher reads your own notes and points to the chapter that answers, no network needed. Try it."
        />

        <div className="mx-auto mt-14 max-w-2xl">
          <div className="sheet p-5">
            <div className="flex items-center gap-3 border-b border-dashed border-line-strong pb-3">
              <span className="font-meta text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                ask bar
              </span>
              <span className="ml-auto flex gap-1.5">
                <span className="rounded-full border border-line px-2.5 py-0.5 font-meta text-[10px] text-ink-faint">
                  online
                </span>
                <span className="rounded-full bg-rust px-2.5 py-0.5 font-meta text-[10px] text-white">
                  offline
                </span>
              </span>
            </div>
            <label htmlFor="ask-input" className="sr-only">
              Ask your notes a question
            </label>
            <input
              id="ask-input"
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ask anything you have a note on"
              className="mt-4 w-full bg-transparent font-display text-xl text-ink outline-none placeholder:text-ink-faint"
            />
          </div>

          <div className="mt-8" aria-live="polite">
            {!searching && (
              <div className="flex items-center gap-4 px-2">
                <SuggestionArrow />
                <div>
                  <p className="hand text-xl text-ink-faint">
                    students keep asking&hellip;
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {[SEARCH_DEMO[0].q, SEARCH_DEMO[3].q, SEARCH_DEMO[1].q].map(
                      (s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setQuery(s);
                            // the chip unmounts as the results appear — move
                            // focus to the input so the keyboard keeps working
                            requestAnimationFrame(() =>
                              document.getElementById("ask-input")?.focus()
                            );
                          }}
                          className="rounded-full border border-dashed border-line-strong bg-card px-4 py-1.5 text-sm text-ink-soft transition-colors duration-300 ease-out hover:border-rust hover:text-rust-deep"
                        >
                          {s}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {searching && results.length === 0 && (
              <div className="sheet p-5">
                <p className="font-medium">nothing in your notes on that yet</p>
                <p className="mt-1 text-sm text-ink-soft">
                  import the chapter, and it becomes searchable
                </p>
              </div>
            )}

            {results.map((r, i) => (
              <Reveal key={r.q} delay={i * 0.05}>
                <div className="sheet relative mb-4 ml-1 flex gap-4 p-5 pl-6">
                  <span className="hand absolute -top-3 left-4 bg-paper px-1 text-base text-rust-deep">
                    {r.hit.split(" · ")[0]}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1.5 rounded-l bg-rust"
                  />
                  <div>
                    <p className="font-medium">{r.q}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      {r.snippet}
                    </p>
                    <p className="mt-2.5 font-meta text-[10px] uppercase tracking-[0.18em] text-rust-deep">
                      {r.hit}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}

            {searching && results.length > 0 && (
              <p className="mt-4 text-sm text-ink-faint">
                {results.length} chapter{results.length > 1 ? "s" : ""} match
              </p>
            )}
          </div>

          <p className="mt-10 border-t border-dashed border-line-strong pt-4 text-sm text-ink-faint">
            the app matches topics offline; online mode summarizes across them
          </p>
        </div>
      </div>
    </section>
  );
}
