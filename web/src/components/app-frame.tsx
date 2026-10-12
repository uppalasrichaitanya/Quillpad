import type { ReactNode } from "react";
import { SEED_NOTES } from "../seed";
import { QuillMark } from "./quill-mark";

const SUBJECTS = [...new Set(SEED_NOTES.map((n) => n.subject))];

/**
 * The desktop app's window, re-created in HTML at small scale: the cream
 * sidebar with subject groups, and a main area for whatever step is showing.
 */
export function AppFrame({ active, children }: { active?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-black/40 shadow-[var(--shadow-paper-lift)]">
      <div className="flex h-7 items-center gap-1.5 bg-[#2a241d] px-3" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-[#4a4036]" />
        <span className="size-2.5 rounded-full bg-[#4a4036]" />
        <span className="size-2.5 rounded-full bg-[#4a4036]" />
        <span className="ml-3 font-mono text-[10px] text-cream-soft">Quillpad</span>
      </div>
      <div className="grid h-[400px] grid-cols-1 text-ink sm:grid-cols-[176px_1fr]">
        <aside className="hidden bg-paper-deep px-3 py-4 sm:block" aria-hidden="true">
          <div className="mb-4 flex items-center gap-1.5">
            <QuillMark className="size-4 text-ink" />
            <span className="font-display text-[14px] font-semibold">Quillpad</span>
          </div>
          {SUBJECTS.map((s) => (
            <div key={s} className="mb-3">
              <div className="mb-1 font-mono text-[8.5px] tracking-[0.16em] text-ink-soft uppercase">{s}</div>
              {SEED_NOTES.filter((n) => n.subject === s).map((n) => {
                const on = active === `${n.subject}${n.num}`;
                return (
                  <div
                    key={n.num}
                    className={`truncate border-l-2 py-[3px] pl-2 text-[11px] ${
                      on ? "border-rust bg-paper/60 text-ink" : "border-transparent text-ink-soft"
                    }`}
                  >
                    <span className="font-mono text-[9px] text-rust-deep">{n.num}</span> {n.title}
                  </div>
                );
              })}
            </div>
          ))}
        </aside>
        <div className="paper relative overflow-hidden rounded-none !shadow-none">{children}</div>
      </div>
    </div>
  );
}
