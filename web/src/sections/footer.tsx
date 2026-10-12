import { QuillMark } from "../components/ui";
import { DOWNLOAD } from "../download-info";

export function Footer() {
  return (
    <footer aria-label="Footer" className="border-t border-dashed border-line-strong py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <QuillMark className="h-6 w-6 text-ink" />
            <span className="font-display text-lg font-semibold">Quillpad</span>
          </div>
          <p className="text-sm text-ink-faint">
            your notes are files. your questions get answered from the chapter
            itself. no account, no telemetry.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-3 text-sm text-ink-faint">
            <span>made with a quill and a compiler</span>
            <span aria-hidden="true" className="hand -rotate-2 text-xl text-rust-deep">
              fig. end of chapter
            </span>
          </div>
          <span className="font-meta text-xs text-ink-faint">v{DOWNLOAD.version}</span>
        </div>
      </div>
    </footer>
  );
}
