import type { ReactNode } from "react";

const README_KEY = "https://github.com/uppalasrichaitanya/Quillpad#getting-your-ai-key-2-minutes";

const FAQ: [string, ReactNode][] = [
  ["Is it free?", "Yes. Quillpad is free to download and use."],
  [
    "Do I need an API key?",
    <>
      Only for the AI parts: turning a chapter into a note, written answers and quiz questions. Reading, searching,
      flashcards and exams work without one. You use your own Anthropic key, so you pay Anthropic directly for what you
      use — setting one up takes about two minutes.{" "}
      <a href={README_KEY} className="text-cream underline decoration-cream/30 underline-offset-4 hover:decoration-cream">
        Here’s how
      </a>
      .
    </>,
  ],
  [
    "What does the AI cost?",
    "It depends on the chapter’s length and the model you pick. A typical chapter costs a few cents to a few tens of cents with the default model, and less with a cheaper one. You can set a spending limit in your Anthropic account.",
  ],
  [
    "Does it work offline?",
    "Yes. Everything except turning new chapters into notes and AI answers works with no internet at all.",
  ],
  [
    "Where are my notes stored?",
    "In a folder on your computer that you choose, as plain Markdown files, one folder per subject. Your API key is kept in Windows Credential Manager.",
  ],
  ["Is there a Mac or Linux version?", "Not yet — Windows only for now."],
];

export function Faq() {
  return (
    <section id="faq" className="relative mx-auto max-w-3xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-24">
      <h2 className="text-[clamp(2rem,4vw,2.9rem)] leading-[1.08] text-cream">Questions</h2>
      <div className="mt-10 divide-y divide-desk-line border-y border-desk-line">
        {FAQ.map(([q, a], i) => (
          <details key={q} className="group py-1" name="faq" open={i === 1}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-display text-[20px] text-cream [&::-webkit-details-marker]:hidden">
              {q}
              <span
                className="relative size-4 shrink-0 before:absolute before:top-1/2 before:left-0 before:h-px before:w-4 before:bg-cream-soft after:absolute after:top-0 after:left-1/2 after:h-4 after:w-px after:bg-cream-soft after:transition-transform group-open:after:scale-y-0"
                aria-hidden="true"
              />
            </summary>
            <div className="max-w-2xl pb-5 text-[16.5px] leading-[1.65] text-cream-soft">{a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
