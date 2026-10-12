/** Front-matter strip: the page opens the way every Quillpad note opens. */

import { Reveal } from "../components/motion-primitives";

const LINES: [string, string][] = [
  ["---", ""],
  ["subject", " everything you study"],
  ["format", "  plain markdown files"],
  ["chapters", " yours"],
  ["distiller", " local-first"],
  ["created", "  today"],
  ["---", ""],
];

export function FrontMatter() {
  return (
    <section
      aria-label="Front matter"
      className="border-y border-dashed border-line-strong bg-shell"
    >
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Reveal>
          <pre className="overflow-x-auto font-meta text-[13px] leading-6">
            {LINES.map(([k, v], i) => (
              <div key={i} className="flex">
                <span
                  className={
                    k === "---" ? "text-ink-faint" : "font-medium text-rust"
                  }
                >
                  {k}
                </span>
                {v ? (
                  <>
                    <span className="text-ink-faint">:</span>
                    <span className="text-ink-soft">{v}</span>
                  </>
                ) : null}
              </div>
            ))}
          </pre>
        </Reveal>
      </div>
    </section>
  );
}
