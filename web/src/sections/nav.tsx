import { useEffect, useState } from "react";
import { QuillMark } from "../components/quill-mark";
import { RELEASE } from "../release";

const LINKS = [
  ["How it works", "#how"],
  ["Features", "#features"],
  ["FAQ", "#faq"],
] as const;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 ${
        scrolled ? "border-b border-desk-line bg-desk/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded focus:bg-paper focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8" aria-label="Main">
        <a href="#top" className="flex items-center gap-2.5 text-cream">
          <QuillMark className="size-7" />
          <span className="font-display text-[21px] font-semibold tracking-tight">Quillpad</span>
        </a>
        <div className="flex items-center gap-7">
          <ul className="hidden items-center gap-7 text-[15px] text-cream-soft md:flex">
            {LINKS.map(([label, href]) => (
              <li key={href}>
                <a href={href} className="transition-colors hover:text-cream">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={RELEASE.url}
            className="rounded-full bg-rust-deep px-4 py-2 text-[15px] font-semibold text-paper transition-colors hover:bg-rust"
          >
            Download
          </a>
        </div>
      </nav>
    </header>
  );
}
