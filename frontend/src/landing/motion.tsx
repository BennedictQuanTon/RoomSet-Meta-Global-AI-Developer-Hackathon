// The landing page's motion vocabulary. Slow, masked and quiet: lines rise, rules draw, images unveil.

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_INOUT = [0.76, 0, 0.24, 1] as const;

const VIEW = { once: true, margin: "-8% 0px" } as const;

/** Each line rises out of its own mask, so a heading sets itself one line at a time. */
export function Lines({ lines, as: Tag = "h2", className, delay = 0 }: {
  lines: string[];
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
}) {
  // The trigger sits on the parent: a line hidden inside its mask never counts as in view by itself.
  const Container = motion[Tag];
  return (
    <Container className={className} aria-label={lines.join(" ")} initial="hidden" whileInView="shown" viewport={VIEW}>
      {lines.map((line, index) => (
        <span key={line} className="mask" aria-hidden="true">
          <motion.span
            variants={{ hidden: { y: "108%" }, shown: { y: "0%" } }}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: delay + index * 0.08 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Container>
  );
}

/** A hairline that draws itself from left to right. */
export function Rule({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="rule"
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.4, ease: EASE_INOUT, delay }}
    />
  );
}

export function Fade({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEW}
      transition={{ duration: 0.9, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/** An image that opens from its center band and settles in scale. */
export function Unveil({ src, alt, className, delay = 0, parallax = false }: {
  src: string;
  alt: string;
  className?: string;
  delay?: number;
  parallax?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], parallax && !reduced ? ["-6%", "6%"] : ["0%", "0%"]);
  return (
    <motion.div
      ref={frame}
      className={`unveil ${className ?? ""}`}
      initial={{ clipPath: "inset(14% 0% 14% 0%)" }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
      viewport={VIEW}
      transition={{ duration: 1.3, ease: EASE_INOUT, delay }}
    >
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{ y, scale: parallax ? 1.14 : undefined }}
        initial={parallax ? undefined : { scale: 1.12 }}
        whileInView={parallax ? undefined : { scale: 1 }}
        viewport={VIEW}
        transition={{ duration: 1.7, ease: EASE_OUT, delay }}
      />
    </motion.div>
  );
}
