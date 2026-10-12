/** UI atoms: the quill mark, buttons, section headers, diagram helpers. */

export function QuillMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="256"
        cy="230"
        r="150"
        stroke="currentColor"
        stroke-width="58"
      />
      <path
        d="M 452 84 C 368 168 322 300 334 388"
        stroke="currentColor"
        stroke-width="54"
        stroke-linecap="round"
      />
      <path
        d="M 414 130 C 388 118 366 118 350 126"
        stroke="currentColor"
        stroke-width="30"
        stroke-linecap="round"
      />
      <path
        d="M 300 392 C 316 434 348 456 386 462"
        stroke="#b1512c"
        stroke-width="40"
        stroke-linecap="round"
      />
    </svg>
  );
}

export function Button({
  href,
  children,
  variant = "primary",
  download,
  className = "",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  download?: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const base =
    "group inline-flex items-center justify-center gap-2.5 rounded-full font-medium transition-colors duration-300 ease-out";
  const styles =
    variant === "primary"
      ? "bg-rust text-white hover:bg-rust-deep"
      : "border border-line-strong text-ink hover:border-rust";
  return (
    <a
      href={href}
      download={download}
      onClick={onClick}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </a>
  );
}

/** Numbered section opener with a handwritten margin annotation. */
export function SectionHead({
  index,
  kicker,
  title,
  lead,
  annotation,
  titleId,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  annotation?: string;
  /** id for the heading, so the section's aria-labelledby resolves */
  titleId?: string;
}) {
  return (
    <header className="relative mx-auto max-w-6xl px-6">
      <div className="flex items-baseline gap-4">
        <span
          aria-hidden="true"
          className="font-display text-5xl italic leading-none text-rust"
        >
          {index}
        </span>
        <p className="kicker">{kicker}</p>
        <span
          aria-hidden="true"
          className="h-px flex-1 border-t border-dashed border-line-strong"
        />
      </div>
      <h2
        id={titleId}
        className="mt-5 font-display text-mega font-semibold leading-[1.02] tracking-tight"
      >
        {title}
      </h2>
      {lead ? (
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          {lead}
        </p>
      ) : null}
      {annotation ? (
        <span
          aria-hidden="true"
          className="hand mt-3 inline-block -rotate-2 text-2xl"
        >
          {annotation}
        </span>
      ) : null}
    </header>
  );
}
