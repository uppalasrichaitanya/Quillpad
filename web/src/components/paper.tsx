import type { CSSProperties, ReactNode } from "react";

/** A sheet of Quillpad paper lying on the desk. */
export function Paper({
  children,
  className = "",
  tilt = 0,
  tape = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
  tape?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`paper relative rounded-[3px] ${className}`}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined, ...style }}
    >
      {tape && (
        <>
          <span className="tape -top-3 left-8 -rotate-6" aria-hidden="true" />
          <span className="tape -top-3 right-8 rotate-[5deg]" aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  );
}

/** The meta line the app prints above every note title. */
export function NoteEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] tracking-[0.14em] text-rust-deep uppercase">{children}</div>
  );
}
