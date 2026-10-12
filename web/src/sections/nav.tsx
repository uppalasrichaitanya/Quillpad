/** Fixed nav: paper glass, condenses on scroll, rust progress hairline. */

import { useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";
import { QuillMark } from "../components/ui";
import { DOWNLOAD } from "../download-info";

const LINKS = [
  { href: "#transform", label: "How it works" },
  { href: "#study", label: "Study tools" },
  { href: "#yours", label: "Your files" },
  { href: "#download", label: "Download" },
];

export function Nav() {
  const reduce = useReducedMotion();
  const [slim, setSlim] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    mass: 0.4,
  });

  useMotionValueEvent(scrollY, "change", (v) => {
    setSlim(v > 40);
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <nav
        aria-label="Main"
        className={`mx-auto flex max-w-6xl items-center justify-between px-6 transition-all duration-300 ease-out ${
          slim && !reduce ? "py-2.5" : "py-4"
        }`}
      >
        <a href="#top" className="flex items-center gap-2.5">
          <QuillMark className="h-7 w-7 text-ink" />
          <span className="font-display text-xl font-semibold tracking-tight">
            Quillpad
          </span>
        </a>
        <ul className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="inline-block py-2 font-meta text-xs uppercase tracking-[0.14em] text-ink-soft transition-colors duration-300 ease-out hover:text-rust-deep"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href={DOWNLOAD.href}
          download={DOWNLOAD.fileName}
          className="rounded-full bg-rust px-4 py-2 text-sm font-medium text-white transition-colors duration-300 ease-out hover:bg-rust-deep"
        >
          Get the app
        </a>
      </nav>
      {!reduce && (
        <motion.div
          className="absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-rust"
          style={{ scaleX: progress }}
        />
      )}
    </header>
  );
}
