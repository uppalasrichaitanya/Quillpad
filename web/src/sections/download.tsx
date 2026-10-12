import { useState } from "react";
import { Paper } from "../components/paper";
import { QuillMark } from "../components/quill-mark";
import { RELEASE, RELEASE_MB } from "../release";

export function Download() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(RELEASE.sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the hash is still selectable */
    }
  };

  return (
    <section id="download" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 lg:py-24">
      <Paper className="mx-auto max-w-2xl px-7 py-10 text-center sm:px-14 sm:py-14" tilt={-0.6} tape>
        <QuillMark className="mx-auto size-12 text-ink" />
        <h2 className="mt-5 text-[clamp(2rem,4vw,2.9rem)] leading-[1.08] text-ink">Get Quillpad</h2>
        <p className="mx-auto mt-3 max-w-md text-[1.0625rem] text-ink-soft">
          Free, for Windows 10 and 11. One file — no installer, no account.
        </p>
        <a
          href={RELEASE.url}
          data-testid="download-link"
          className="mt-8 inline-flex items-center gap-3 rounded-full bg-rust-deep px-8 py-4 text-[18px] font-semibold text-paper shadow-[0_10px_30px_-10px_rgb(160_74_39/0.7)] transition-colors hover:bg-rust"
        >
          Download Quillpad {RELEASE.version}
        </a>
        <p className="mt-3 text-[14px] text-ink-soft">
          {RELEASE.fileName}, {RELEASE_MB} MB
        </p>

        <div className="mx-auto mt-9 max-w-lg rounded-md border border-dashed border-ink/30 px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-semibold text-ink-soft">SHA-256 checksum</span>
            <button
              type="button"
              onClick={copy}
              data-testid="copy-sha"
              className="rounded-full border border-ink/25 px-3 py-0.5 text-[12.5px] text-ink transition-colors hover:border-ink/60"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <code className="mt-1.5 block font-mono text-[11.5px] leading-[1.6] break-all text-ink">{RELEASE.sha256}</code>
        </div>

        <p className="mx-auto mt-7 max-w-md text-[14.5px] leading-[1.6] text-ink-soft">
          The app isn’t code-signed yet, so Windows may say it “protected your PC”. Choose <strong className="text-ink">More info</strong>, then{" "}
          <strong className="text-ink">Run anyway</strong>.
        </p>
        <a href={RELEASE.releasesUrl} className="mt-5 inline-block text-[14.5px] text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          All releases on GitHub
        </a>
      </Paper>
    </section>
  );
}
