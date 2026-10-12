/** Index tab rail: right-edge notebook dividers that extend when their
 *  plate is in view. Click to jump. */

import { useEffect, useState } from "react";

const PLATES = [
  { id: "transform", label: "the read" },
  { id: "study", label: "study" },
  { id: "ask-demo", label: "ask" },
  { id: "yours", label: "files" },
  { id: "engine", label: "engine" },
  { id: "download", label: "get" },
];

export function IndexTabs() {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    // keep every observation, then pick the closest to the reading line —
    // callback order alone can name the wrong plate on fast scrolls
    const seen = new Map<string, IntersectionObserverEntry>();
    const pick = () => {
      let best = -1;
      let bestDistance = Infinity;
      for (const [id, entry] of seen) {
        if (!entry.isIntersecting) continue;
        const distance = Math.abs(entry.boundingClientRect.top);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = PLATES.findIndex((p) => p.id === id);
        }
      }
      setActive(best);
    };
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e));
        pick();
      },
      { rootMargin: "-38% 0px -50% 0px" }
    );
    PLATES.forEach((p) => {
      const el = document.getElementById(p.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <nav className="tab-rail" aria-label="Plates">
      {PLATES.map((p, i) => (
        <a
          key={p.id}
          href={`#${p.id}`}
          className={`tab ${i === active ? "active" : ""}`}
          aria-current={i === active ? "location" : undefined}
        >
          {p.label}
        </a>
      ))}
    </nav>
  );
}
