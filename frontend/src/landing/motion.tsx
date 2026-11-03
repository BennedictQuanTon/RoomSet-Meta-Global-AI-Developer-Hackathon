// Motion is kept for the moments that matter: large blocks settle in once, on the compositor only.
// One shared observer and CSS transitions keep scrolling smooth.

import { useEffect, useRef, type ReactNode } from "react";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_INOUT = [0.76, 0, 0.24, 1] as const;

let shared: IntersectionObserver | null = null;

function observer(): IntersectionObserver {
  shared ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          shared?.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  return shared;
}

export function Reveal({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "figure" }) {
  const element = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    observer().observe(node);
    return () => observer().unobserve(node);
  }, []);
  return <Tag ref={element as never} className={`reveal ${className}`}>{children}</Tag>;
}
