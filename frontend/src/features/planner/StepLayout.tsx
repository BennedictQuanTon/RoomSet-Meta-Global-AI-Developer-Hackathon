// Each planning step fills the window: a photograph with the question, and the work beside it.

import type { ReactNode } from "react";

export function StepLayout({ image, title, lead, children }: { image: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="plan-step">
      <aside className="plan-stage">
        <img src={image} alt="" />
        <div className="plan-stage-copy">
          <h2>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
      </aside>
      <div className="plan-work">
        <div className="plan-work-inner">{children}</div>
      </div>
    </section>
  );
}
