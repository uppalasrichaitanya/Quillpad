/** The Quill Trail: self-writing ink flourishes behind the hero.
 *  Canvas 2D, lazy-mounted, with a static SVG render when reduced motion is
 *  set, and no blank canvas if 2D is unavailable. */

import { Suspense, lazy } from "react";
import { useReducedMotion } from "motion/react";
import { Component, useRef, type ReactNode } from "react";

const QuillFieldCanvas = lazy(() => import("./quill-field-canvas"));

/** Static printed strokes for the reduced-motion / no-2D path. */
function StaticTrails({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <title>decorative cursive trails</title>
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M 960 210 q 26 -34 46 -8 q 18 24 -4 40 q 30 -22 44 -6 q 12 14 -4 30 q 26 -18 44 -10 t 60 24"
          stroke="#362b1e"
          strokeWidth="2"
          opacity="0.75"
        />
        <path
          d="M 240 640 q 20 -26 38 -6 q 16 18 -6 32 q 28 -14 40 2 q 20 -18 38 -8 q 14 8 48 20"
          stroke="#b1512c"
          strokeWidth="1.8"
          opacity="0.55"
        />
        <path
          d="M 1060 540 q 24 -40 48 -10 q 18 22 -4 36 q 30 -20 46 -2 q 44 26 70 30"
          stroke="#362b1e"
          strokeWidth="2"
          opacity="0.65"
        />
      </g>
    </svg>
  );
}

class TrailBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function QuillTrail() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0">
        {reduce ? (
          <StaticTrails className="h-full w-full" />
        ) : (
          <TrailBoundary fallback={<StaticTrails className="h-full w-full" />}>
            <Suspense fallback={<StaticTrails className="h-full w-full" />}>
              <QuillFieldCanvas className="h-full w-full" />
            </Suspense>
          </TrailBoundary>
        )}
      </div>
      {/* soft paper veils behind the copy; strokes are already kept out of
          the reading column by the field's own quiet zone */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#f3eadacc_0%,#f3eada99_40%,#f3eada1a_68%,transparent_88%)] lg:hidden" />
      <div className="absolute inset-0 hidden bg-[linear-gradient(to_right,#f3eadae6_0%,#f3eadaa6_52%,#f3eada33_80%,transparent_94%)] lg:block" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#f3eada_86%)]" />
    </div>
  );
}
