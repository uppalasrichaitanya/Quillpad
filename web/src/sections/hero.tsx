import { DistillSequence } from "../components/distill-sequence";
import { RELEASE, RELEASE_MB } from "../release";

export function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-6xl px-5 pt-32 pb-20 sm:px-8 lg:pt-40 lg:pb-28">
      <div className="grid items-center gap-16 lg:grid-cols-[1.08fr_1fr] lg:gap-10">
        <div className="max-w-xl">
          <h1 className="text-[clamp(2.75rem,6.4vw,5.25rem)] leading-[1.02] text-cream">
            Turn any chapter into notes worth keeping.
          </h1>
          <p className="mt-7 max-w-[34rem] text-[1.1875rem] leading-[1.6] text-cream-soft">
            Drop in a chapter PDF. Quillpad writes the summary, pulls out the points that matter, answers
            your questions and redraws every diagram by hand — saved as plain files on your own computer.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a
              href={RELEASE.url}
              className="inline-flex items-center gap-3 rounded-full bg-rust-deep px-7 py-3.5 text-[17px] font-semibold text-paper shadow-[0_10px_30px_-10px_rgb(188_90_50/0.6)] transition-colors hover:bg-rust"
            >
              <WindowsGlyph />
              Download for Windows
            </a>
            <a href="#how" className="text-[16px] text-cream underline decoration-cream/30 underline-offset-[6px] transition-colors hover:decoration-cream">
              See how it works
            </a>
          </div>
          <p className="mt-5 text-[14.5px] text-cream-soft">
            Free for Windows 10 and 11. Version {RELEASE.version}, {RELEASE_MB} MB, no installer.
          </p>
        </div>
        <DistillSequence />
      </div>
    </section>
  );
}

function WindowsGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M0 2.3 6.5 1.4v6.2H0zM7.3 1.3 16 0v7.6H7.3zM0 8.4h6.5v6.2L0 13.7zM7.3 8.4H16V16l-8.7-1.2z" />
    </svg>
  );
}
