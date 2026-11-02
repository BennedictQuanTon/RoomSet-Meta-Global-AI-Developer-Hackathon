// The first visit: a hairline fills as the hero photo loads, then the page lifts into view.

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { EASE_INOUT } from "./motion";

const KEY = "roomset.intro";
const MIN_MS = 1100;
const MAX_MS = 2400;

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // The intro simply plays again.
  }
}

export function shouldPlayIntro(): boolean {
  return !alreadySeen() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Intro({ image, onReveal, onDone }: { image: string; onReveal: () => void; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const started = performance.now();
    let cancelled = false;
    const leave = () => {
      if (cancelled) return;
      const wait = Math.max(0, MIN_MS - (performance.now() - started));
      window.setTimeout(() => {
        if (cancelled) return;
        remember();
        setLeaving(true);
        onReveal();
      }, wait);
    };
    const photo = new Image();
    photo.src = image;
    const fallback = window.setTimeout(leave, MAX_MS);
    photo.decode().then(leave, leave).finally(() => window.clearTimeout(fallback));
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [image, onReveal]);

  return (
    <motion.div
      className="lp-intro"
      initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
      animate={leaving ? { clipPath: "inset(0% 0% 100% 0%)" } : undefined}
      transition={{ duration: 1.05, ease: EASE_INOUT }}
      onAnimationComplete={() => leaving && onDone()}
      aria-hidden="true"
    >
      <motion.img
        src="/brand/logo-dark.png"
        alt=""
        width={190}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: leaving ? 0 : 1, y: 0 }}
        transition={{ duration: 0.7 }}
      />
      <div className="lp-intro-track">
        <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: MIN_MS / 1000, ease: EASE_INOUT }} />
      </div>
    </motion.div>
  );
}
