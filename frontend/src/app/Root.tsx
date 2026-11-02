// Two pages: the landing page at / and the working app at /app, joined by one curtain transition.

import { MotionConfig, motion, useAnimationControls } from "motion/react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Landing } from "../landing/Landing";
import { EASE_INOUT } from "../landing/motion";
import { onNavigate } from "./nav";

const AppPage = lazy(() => import("./App").then((module) => ({ default: module.App })));

const StudioPage = lazy(() => import("../studio/Studio").then((module) => ({ default: module.Studio })));

const COVER = "inset(100% 0% 0% 0%)";
const FULL = "inset(0% 0% 0% 0%)";
const GONE = "inset(0% 0% 100% 0%)";
const DURATION_S = 0.7;

export function Root() {
  const [path, setPath] = useState(window.location.pathname);
  const curtain = useAnimationControls();
  const busy = useRef(false);

  const go = useCallback(
    async (next: string, push: boolean) => {
      if (busy.current) return;
      if (/^https?:/.test(next)) {
        window.location.href = next;
        return;
      }
      busy.current = true;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        curtain.set({ clipPath: COVER });
        await curtain.start({ clipPath: FULL, transition: { duration: DURATION_S, ease: EASE_INOUT } });
      }
      if (push) window.history.pushState({}, "", next);
      setPath(next);
      window.scrollTo(0, 0);
      if (!reduced) await curtain.start({ clipPath: GONE, transition: { duration: DURATION_S, ease: EASE_INOUT, delay: 0.12 } });
      busy.current = false;
    },
    [curtain],
  );

  useEffect(() => onNavigate((next) => void go(next, true)), [go]);
  useEffect(() => {
    const onPop = () => void go(window.location.pathname, false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [go]);

  return (
    <MotionConfig reducedMotion="user">
      {path.startsWith("/app") ? (
        <Suspense fallback={null}>
          <AppPage />
        </Suspense>
      ) : path.startsWith("/studio") ? (
        <Suspense fallback={null}>
          <StudioPage />
        </Suspense>
      ) : (
        <Landing />
      )}
      <motion.div className="page-curtain" aria-hidden="true" initial={{ clipPath: COVER }} animate={curtain}>
        <img src="/brand/logo-light.png" alt="" />
      </motion.div>
    </MotionConfig>
  );
}
