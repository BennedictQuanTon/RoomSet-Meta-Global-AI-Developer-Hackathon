// Transparent nav over a full-screen photograph. Slides cross-dissolve while the image drifts slowly.

import { motion } from "motion/react";
import { useEffect, useState, type MouseEvent } from "react";
import { APP_PATH, navigate } from "../app/nav";
import { HERO_SLIDES, NAV_LINKS } from "./content";
import { EASE_OUT } from "./motion";

const AUTOPLAY_MS = 6500;

export function goToApp(event: MouseEvent): void {
  event.preventDefault();
  navigate(APP_PATH);
}

function Nav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const check = () => setSolid(window.scrollY > window.innerHeight - 90);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return (
    <nav className={solid ? "lp-nav is-solid" : "lp-nav"} aria-label="Main">
      <a className="lp-nav-logo" href="/" aria-label="Roomset home">
        <img src="/brand/logo-light.png" alt="roomset" className="logo-on-photo" />
        <img src="/brand/logo-dark.png" alt="" aria-hidden="true" className="logo-on-canvas" />
      </a>
      <div className="lp-nav-links">
        {NAV_LINKS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
      </div>
      <div className="lp-nav-end">
        <a className="lp-try" href={APP_PATH} onClick={goToApp}>Try Roomset</a>
      </div>
    </nav>
  );
}

export function Hero({ play }: { play: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    HERO_SLIDES.forEach((slide) => {
      new Image().src = slide.src;
    });
  }, []);

  useEffect(() => {
    if (paused || !play || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((active + 1) % HERO_SLIDES.length), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused, play]);

  return (
    <header className="lp-top">
      <Nav />
      <div className="lp-hero">
        {HERO_SLIDES.map((slide, index) => (
          <div key={slide.src} className={index === active ? "lp-slide is-active" : "lp-slide"} aria-hidden={index !== active}>
            <img src={slide.src} alt={slide.alt} fetchPriority={index === 0 ? "high" : "low"} />
          </div>
        ))}
        <div className="lp-hero-title">
          <p className="lp-hero-label" key={active}>{HERO_SLIDES[active].label}</p>
          <h1 aria-label="Roomset">
            <span className="mask" aria-hidden="true">
              <motion.span
                initial={{ y: "108%" }}
                animate={play ? { y: "0%" } : undefined}
                transition={{ duration: 1.3, ease: EASE_OUT, delay: 0.25 }}
              >
                roomset
              </motion.span>
            </span>
          </h1>
        </div>
        <div className="lp-thumbs" role="group" aria-label="Choose a room" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
          {HERO_SLIDES.map((slide, index) => (
            <button key={slide.src} className={index === active ? "lp-thumb is-active" : "lp-thumb"} onClick={() => setActive(index)} aria-label={slide.label} aria-pressed={index === active}>
              <img src={slide.src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
