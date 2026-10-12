/** The Floating Quill — the app icon's mark. Ink follows currentColor. */
export function QuillMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" aria-hidden="true">
      <circle cx="256" cy="230" r="150" stroke="currentColor" strokeWidth="58" />
      <path d="M 452 84 C 368 168 322 300 334 388" stroke="currentColor" strokeWidth="54" strokeLinecap="round" />
      <path d="M 414 130 C 388 118 366 118 350 126" stroke="currentColor" strokeWidth="30" strokeLinecap="round" />
      <path d="M 300 392 C 316 434 348 456 386 462" stroke="#bc5a32" strokeWidth="40" strokeLinecap="round" />
    </svg>
  );
}
