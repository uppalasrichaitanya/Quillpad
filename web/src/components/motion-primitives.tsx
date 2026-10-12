/** Motion primitives: grounded in design-taste-mcp presets.
 *  Scroll reveal = spring (damping 20, stiffness 200, no duration/easing).
 *  Hover tweens = 0.3s easeOut (Motion's documented default). */

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { SPRING_REVEAL } from "../sections/constants";

export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "span" | "p" | "h2" | "h3";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      initial={{ y: 16, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ ...SPRING_REVEAL, delay }}
    >
      {children}
    </Tag>
  );
}

/** Masked word rise for the hero headline. */
export const wordRise: Variants = {
  hidden: { y: "110%", opacity: 0 },
  show: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: { ...SPRING_REVEAL, delay: 0.04 * i },
  }),
};

export function WordMask({
  words,
  className,
  accentFrom,
}: {
  words: string[];
  className?: string;
  accentFrom?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden pb-[0.08em] align-bottom"
        >
          <motion.span
            className={
            accentFrom !== undefined && i >= accentFrom
              ? "inline-block text-rust"
              : "inline-block"
            }
            variants={reduce ? undefined : wordRise}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
            custom={i}
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
