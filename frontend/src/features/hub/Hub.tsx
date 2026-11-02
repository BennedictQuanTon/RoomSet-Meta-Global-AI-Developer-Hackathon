// The doorway after "Try": two full-height rooms to walk into. Every part of the product starts here.

import { ArrowUpRight, Box, Compass, Move, Ruler, ScanLine, Sofa, type LucideIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { navigate } from "../../app/nav";
import { loadAuth } from "../../app/sessionStore";
import "./hub.css";

function go(path: string) {
  return (event: MouseEvent) => {
    event.preventDefault();
    navigate(path);
  };
}

function Door({ href, image, alt, index, kicker, title, body, points, action }: {
  href: string;
  image: string;
  alt: string;
  index: string;
  kicker: string;
  title: ReactNode;
  body: string;
  points: [LucideIcon, string][];
  action: string;
}) {
  return (
    <a className="hub-door" href={href} onClick={go(href)}>
      <img src={image} alt={alt} decoding="async" />
      <span className="hub-shade" aria-hidden="true" />
      <span className="hub-index" aria-hidden="true">{index}</span>
      <span className="hub-copy">
        <span className="hub-kicker">{kicker}</span>
        <span className="hub-title">{title}</span>
        <span className="hub-body">{body}</span>
        <span className="hub-points">
          {points.map(([Icon, label]) => <span key={label}><Icon size={18} strokeWidth={1.4} />{label}</span>)}
        </span>
        <span className="hub-action">{action}<ArrowUpRight size={20} strokeWidth={1.4} /></span>
      </span>
    </a>
  );
}

export function Hub() {
  const hasPlan = Boolean(loadAuth());
  return (
    <div className="hub">
      <header className="hub-top">
        <a href="/" onClick={go("/")} aria-label="Roomset home"><img src="/brand/logo-light.png" alt="roomset" /></a>
        <h1>Where would you like to <em>begin?</em></h1>
        <a className="hub-about" href="/" onClick={go("/")}>About Roomset</a>
      </header>
      <main className="hub-doors">
        <Door
          href="/studio"
          image="/landing/hub-studio.webp"
          alt="Furniture inside a 3D room built from real photographs"
          index="01"
          kicker="Sample apartment"
          title={<>Walk through a <em>furnished</em> home</>}
          body="Real rooms in true 3D. Nothing to set up."
          points={[[Box, "Orbit in 3D"], [Move, "Move anything"], [Compass, "Architect's review"]]}
          action="Enter the apartment"
        />
        <Door
          href="/app"
          image="/landing/hero-lounge.webp"
          alt="A bright lounge with armchairs, a sofa and a chandelier"
          index="02"
          kicker="Your room"
          title={<>Plan <em>your own</em> space</>}
          body={hasPlan ? "Your plan is saved on this device." : "Your sofa, your measurements, your layout."}
          points={[[Sofa, "Confirm a sofa"], [ScanLine, "Show the room"], [Ruler, "Check the fit"]]}
          action={hasPlan ? "Continue your plan" : "Start a plan"}
        />
      </main>
    </div>
  );
}
