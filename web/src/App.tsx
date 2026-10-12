import { useEffect } from "react";
import { Nav } from "./sections/nav";
import { Hero } from "./sections/hero";
import { FrontMatter } from "./sections/frontmatter";
import { Transform } from "./sections/transform";
import { Study } from "./sections/study";
import { Ask } from "./sections/ask";
import { Yours } from "./sections/yours";
import { Engine } from "./sections/engine";
import { Download } from "./sections/download";
import { Footer } from "./sections/footer";
import { IndexTabs } from "./components/tabs";

export default function App() {
  // In-page links scroll but leave focus on the link that was activated, so the
  // next Tab continues from the nav instead of the section the user jumped to.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href^='#']");
      if (!anchor) return;
      const id = anchor.getAttribute("href")?.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      requestAnimationFrame(() => {
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div id="top" className="min-h-svh bg-paper text-ink">
      <Nav />
      <IndexTabs />
      <div className="margin-rail hidden xl:block" aria-hidden="true">
        <i />
      </div>
      <Hero />
      <main id="main">
        <FrontMatter />
        <Transform />
        <Study />
        <Ask />
        <Yours />
        <Engine />
        <Download />
      </main>
      <Footer />
    </div>
  );
}
