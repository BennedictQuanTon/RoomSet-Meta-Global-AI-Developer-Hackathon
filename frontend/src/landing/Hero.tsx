// The framed nav and full-photo hero. Only the display word and thumbnails sit on the image.

import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { APP_PATH, navigate } from "../app/nav";
import { HERO_SLIDES, NAV_LINKS } from "./content";
import { EASE_INOUT, EASE_OUT } from "./motion";

const AUTOPLAY_MS = 6500;

export function goToApp(event: MouseEvent): void {
  event.preventDefault();
  navigate(APP_PATH);
}

export function Hero({ play }: { play: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start start", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", "9%"]);
  const slide = HERO_SLIDES[active];

  useEffect(() => {
    if (paused || !play || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((active + 1) % HERO_SLIDES.length), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused, play]);

  return (
    <header className="lp-top">
      <motion.nav
        className="lp-nav"
        aria-label="Main"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : undefined}
        transition={{ duration: 0.8, delay: 0.55 }}
      >
        <a className="lp-nav-logo" href="/" aria-label="Roomset home"><img src="/roomset-logo.png" alt="roomset" /></a>
        <div className="lp-nav-links">
          {NAV_LINKS.map(([label, href]) => <a key={href} className="lp-nav-cell" href={href}>{label}</a>)}
        </div>
        <span className="lp-nav-spacer" />
        <a className="lp-nav-cell lp-nav-try" href={APP_PATH} onClick={goToApp}>Try</a>
      </motion.nav>

      <div className="lp-hero" ref={frame} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.src}
            className="lp-hero-photo"
            style={{ y: photoY }}
            initial={{ clipPath: "inset(0% 0% 0% 100%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ opacity: 1, transition: { duration: 1.25 } }}
            transition={{ duration: 1.2, ease: EASE_INOUT }}
          >
            <motion.img
              src={slide.src}
              alt={slide.alt}
              fetchPriority="high"
              initial={{ scale: 1.12 }}
              animate={play ? { scale: 1 } : undefined}
              transition={{ duration: 2.2, ease: EASE_OUT }}
            />
          </motion.div>
        </AnimatePresence>

        <div className="lp-hero-title">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={slide.label}
              className="t-label on-photo"
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : undefined}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: play ? 0.2 : 0 }}
            >
              {slide.label}
            </motion.p>
          </AnimatePresence>
          <h1 className="lp-hero-word" aria-label="Roomset">
            <span className="mask" aria-hidden="true">
              {"roomset".split("").map((letter, index) => (
                <motion.span
                  key={index}
                  initial={{ y: "112%" }}
                  animate={play ? { y: "0%" } : undefined}
                  transition={{ duration: 1.25, ease: EASE_OUT, delay: 0.3 + index * 0.05 }}
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          </h1>
        </div>

        <motion.div
          className="lp-thumbs"
          role="group"
          aria-label="Choose a room"
          initial={{ opacity: 0, y: 12 }}
          animate={play ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.95 }}
        >
          {HERO_SLIDES.map((item, index) => (
            <button
              key={item.src}
              className={index === active ? "lp-thumb is-active" : "lp-thumb"}
              onClick={() => setActive(index)}
              aria-label={item.label}
              aria-pressed={index === active}
            >
              <img src={item.src} alt="" loading="lazy" />
            </button>
          ))}
        </motion.div>
      </div>
    </header>
  );
}
