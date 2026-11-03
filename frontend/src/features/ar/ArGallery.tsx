// "In your room": every catalog piece, one tap from standing on your own floor at its real size.

import { ArrowLeft, Hand, LayoutDashboard, Mic, Move3d, ScanEye, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { api } from "../../api/client";
import { navigate } from "../../app/nav";
import { CATALOG, CATEGORIES, type Category } from "../../studio/apartment";
import { Assistant } from "./Assistant";
import { ROOM_SETS, arHref, arSupport, setHref, sizeLabel } from "./ar";
import "./ar.css";

const go = (path: string) => (event: MouseEvent) => {
  event.preventDefault();
  navigate(path);
};

export function ArGallery() {
  const support = useMemo(arSupport, []);
  const [category, setCategory] = useState<Category | "All">("All");
  // null: no server here (a static preview), so the assistant is hidden.
  const [assistant, setAssistant] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    api.capabilities().then((caps) => setAssistant(Boolean(caps.assistant))).catch(() => setAssistant(null));
  }, []);
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

      {support === "quicklook" && (
        <section className="ar-sets" aria-labelledby="ar-sets-title">
          <h2 id="ar-sets-title"><LayoutDashboard size={20} strokeWidth={1.4} aria-hidden="true" />Furnish a whole room</h2>
          <p>Stand in an empty room and place a full set at once, arranged as in the sample apartment.</p>
          <ul>
            {ROOM_SETS.map((set) => (
              <li key={set.id} className="ar-set">
                <a className="ar-link" rel="ar" href={setHref(set, support)!}>
                  <img src={`/studio/ar/sets/${set.id}.webp`} alt={`${set.name}. Tap to place all ${set.count} pieces in your room`} loading="lazy" />
                </a>
                <span className="ar-badge" aria-hidden="true"><ScanEye size={16} strokeWidth={1.6} />AR</span>
                <div className="ar-meta">
                  <b>{set.name}</b>
                  <span>{set.count} pieces · {set.size[0].toFixed(1)} × {set.size[1].toFixed(1)} m floor</span>
                  <small>{set.pieces.join(", ")}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {support === "quicklook" && <h2 className="ar-section-title">Or one piece at a time</h2>}
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

      {assistant !== null && !asking && (
        <button className="ar-ask" onClick={() => setAsking(true)}><Mic size={20} strokeWidth={1.6} />Ask Roomset</button>
      )}
      {asking && assistant !== null && <Assistant enabled={assistant} support={support} onClose={() => setAsking(false)} />}

      <footer className="ar-foot">
        <p>Width × depth × height. Sizes come from each model's real-world scale. Models are samples, not the exact product. A set moves as one piece; place single pieces to arrange them one by one.</p>
      </footer>
    </div>
  );
}
