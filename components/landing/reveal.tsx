"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";

/**
 * Subtle scroll reveal (opacity + translate).
 *
 * The rendered element never depends on the reduced-motion preference: the server cannot know it,
 * so branching on `useReducedMotion()` here made the first client render differ from the HTML
 * and the server's inline `opacity: 0` stuck after hydration. Instead the same motion element is
 * always rendered and `reducedMotion="user"` makes motion skip the translate for visitors who ask
 * for reduced motion, leaving only a short opacity fade.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const Tag = motion[as];
  return (
    <MotionConfig reducedMotion="user">
      <Tag
        className={className}
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 0.5, delay, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {children}
      </Tag>
    </MotionConfig>
  );
}
