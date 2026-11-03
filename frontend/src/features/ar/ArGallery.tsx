// "In your room": every catalog piece, one tap from standing on your own floor at its real size.

import { ArrowLeft, Hand, Move3d, ScanEye, Smartphone } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { navigate } from "../../app/nav";
import { CATALOG, CATEGORIES, type Category } from "../../studio/apartment";
import { arHref, arSupport, sizeLabel } from "./ar";
import "./ar.css";

const go = (path: string) => (event: MouseEvent) => {
  event.preventDefault();
  navigate(path);
};

export function ArGallery() {
  const support = useMemo(arSupport, []);
  const [category, setCategory] = useState<Category | "All">("All");
  const pieces = CATALOG.filter((item) => item.model && (category === "All" || item.category === category));

  return (
    <div className="ar">
      <header className="ar-top">
        <a href="/" onClick={go("/")} aria-label="Roomset home"><img src="/brand/logo-light.png" alt="roomset" /></a>
        <a className="ar-back" href="/studio" onClick={go("/studio")} aria-label="Back to the sample apartment" title="Sample apartment">
          <ArrowLeft size={20} strokeWidth={1.4} />
        </a>
      </header>

      <section className="ar-hero">
        <p className="ar-kicker">In your room</p>
        <h1>See it at true size, <em>where it will stand.</em></h1>
        <ul className="ar-how">
          <li><ScanEye size={20} strokeWidth={1.4} />Tap a piece, point at the floor</li>
          <li><Hand size={20} strokeWidth={1.4} />One finger moves it</li>
          <li><Move3d size={20} strokeWidth={1.4} />Two fingers turn it</li>
        </ul>
        {support === "none" && (
          <p className="ar-note"><Smartphone size={20} strokeWidth={1.4} />Open this page on an iPhone, iPad or Android phone to place pieces in your room.</p>
        )}
      </section>

      <nav className="ar-filter" aria-label="Categories">
        {(["All", ...CATEGORIES] as const).map((entry) => (
          <button key={entry} className={entry === category ? "is-active" : ""} aria-pressed={entry === category} onClick={() => setCategory(entry)}>{entry}</button>
        ))}
      </nav>

      <ul className="ar-grid">
        {pieces.map((item) => {
          const href = arHref(item, support);
          const thumb = <img src={`/studio/thumbs/${item.model}.webp`} alt={`${item.name}. ${href ? "Tap to place it in your room" : ""}`} loading="lazy" />;
          return (
            <li key={item.id} className={href ? "ar-card" : "ar-card is-static"}>
              {/* AR Quick Look needs the image to be the link's only child. */}
              {href ? <a className="ar-link" rel="ar" href={href}>{thumb}</a> : <div className="ar-link">{thumb}</div>}
              {href && <span className="ar-badge" aria-hidden="true"><ScanEye size={16} strokeWidth={1.6} />AR</span>}
              <div className="ar-meta">
                <b>{item.name}</b>
                <span>{sizeLabel(item)} cm</span>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="ar-foot">
        <p>Width × depth × height. Sizes come from each model's real-world scale. Models are samples, not the exact product.</p>
      </footer>
    </div>
  );
}
