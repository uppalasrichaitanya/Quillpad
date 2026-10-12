import { useEffect, useRef } from "react";
import { createQuillField } from "./quill-field";

/** Mounts the quill trail field. The quiet zone is measured from the hero
 *  copy column so strokes never sit under reading text. */
export default function QuillFieldCanvas({
  className,
}: {
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const hero = canvas.closest<HTMLElement>("#hero");
    const zoneEls = hero ? [...hero.querySelectorAll<HTMLElement>("[data-quiet]")] : [];

    const quietZones = () => {
      if (!zoneEls.length) return [];
      const c = canvas.getBoundingClientRect();
      return zoneEls.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - c.left,
          y: r.top - c.top,
          w: r.width,
          h: r.height,
        };
      });
    };

    const field = createQuillField(canvas, quietZones);
    return () => field.dispose();
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
