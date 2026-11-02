// The planner's top bar: the logo, where you are in the four steps, and icon links out.

import { Armchair, Box, Building2, Camera, LayoutGrid, RotateCcw, Ruler } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { navigate } from "../../app/nav";

const STEPS = [
  { label: "Sofa", Icon: Armchair },
  { label: "Photos", Icon: Camera },
  { label: "Details", Icon: Ruler },
  { label: "Your room", Icon: Box },
];

const CONFIRM_MS = 4000;

const go = (path: string) => (event: MouseEvent) => {
  event.preventDefault();
  navigate(path);
};

interface Props {
  step: number | null;
  onStartOver?: () => void;
}

export function PlannerNav({ step, onStartOver }: Props) {
  // Deleting a plan takes two clicks, because a lone icon is easy to hit by accident.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <header className="plan-nav">
      <a href="/" onClick={go("/")} aria-label="Roomset home"><img src="/brand/logo-dark.png" alt="roomset" /></a>

      {step !== null && (
        <ol className="plan-steps" aria-label="Your progress">
          {STEPS.map(({ label, Icon }, index) => (
            <li key={label} className={index === step ? "is-active" : index < step ? "is-done" : ""} aria-current={index === step ? "step" : undefined} title={label}>
              <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ol>
      )}

      <nav className="plan-links" aria-label="Pages">
        <a href="/start" onClick={go("/start")} aria-label="All options" title="All options"><LayoutGrid size={20} strokeWidth={1.4} /></a>
        <a href="/studio" onClick={go("/studio")} aria-label="Sample apartment" title="Sample apartment"><Building2 size={20} strokeWidth={1.4} /></a>
        {onStartOver && (confirming ? (
          <button className="plan-confirm" onClick={onStartOver}>Delete plan?</button>
        ) : (
          <button onClick={() => setConfirming(true)} aria-label="Start over" title="Start over"><RotateCcw size={20} strokeWidth={1.4} /></button>
        ))}
      </nav>
    </header>
  );
}
