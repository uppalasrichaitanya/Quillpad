/** Paper sheet primitives: stacked sheets, masking tape, binder holes.
 *  Used by hero, transform, study, download. */

import { type ReactNode } from "react";

export function Tape({ at }: { at: "tl" | "tr" }) {
  return (
    <div
      className={`tape ${at === "tl" ? "-left-4 -top-3 -rotate-6 sm:-left-6" : "-right-2 -top-3 rotate-6 sm:-right-4"}`}
      aria-hidden="true"
    />
  );
}

/** A paper sheet with a second sheet peeking behind it. */
export function StackedSheet({
  children,
  tilt = 1,
  className = "",
  deep = false,
}: {
  children: ReactNode;
  tilt?: number;
  className?: string;
  deep?: boolean;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className={`sheet sheet-deep absolute inset-0 ${tilt > 0 ? "rotate-[0.9deg]" : "-rotate-[0.9deg]"}`}
      />
      <div
        className={`sheet relative ${tilt > 0 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"} ${deep ? "sheet-deep" : ""} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
