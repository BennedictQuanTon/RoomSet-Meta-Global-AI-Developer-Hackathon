// "Show it in my style": restyles the current 3D view through Muse Image. Decoration only.

import { useEffect, useState } from "react";
import { ApiError, api, type Auth } from "../../api/client";
import type { RenderView, SessionView } from "../../api/contracts";

const PRESETS = ["Warm Japandi", "Mid-century, walnut", "Bright Scandinavian", "Dark moody lounge"];

function RenderImage({ auth, render }: { auth: Auth; render: RenderView }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let url: string | undefined;
    let alive = true;
    api.blobUrl(auth, `assets/${render.asset}`).then((next) => {
      url = next;
      if (alive) setSrc(next);
      else URL.revokeObjectURL(next);
    }).catch(() => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [auth, render.asset]);
  return (
    <figure className="render">
      {src ? <img src={src} alt={`Style preview: ${render.style_prompt}`} /> : <div className="thumb-placeholder" />}
      <figcaption className="rs-note">{render.style_prompt}. {render.label}</figcaption>
    </figure>
  );
}

interface Props {
  auth: Auth;
  session: SessionView;
  enabled: boolean;
  snapshot: () => Promise<Blob>;
  onSession: (session: SessionView) => void;
}

export function StylePanel({ auth, session, enabled, snapshot, onSession }: Props) {
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const render = await api.createRender(auth, await snapshot(), style);
      onSession({ ...session, renders: [...session.renders, render] });
    } catch (cause) {
      setError((cause as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-card stack style-panel">
      <h3>See it in a style</h3>
      <p className="rs-note">Tell us the look you want. We restyle this view as an AI preview. Size and fit still come from the plan above.</p>
      <div className="chips">
        {PRESETS.map((preset) => (
          <button key={preset} type="button" className={style === preset ? "chip is-active" : "chip"} onClick={() => setStyle(preset)}>{preset}</button>
        ))}
      </div>
      <input className="rs-input" aria-label="Describe a style" maxLength={300} placeholder="Or describe it: linen curtains, oak floor…" value={style} onChange={(e) => setStyle(e.target.value)} />
      <button className="rs-button rs-button--secondary" disabled={!enabled || busy || style.trim().length < 2} onClick={generate}>
        {busy ? "Creating preview…" : "Create style preview"}
      </button>
      {!enabled && <p className="rs-note">Style previews aren't switched on yet.</p>}
      {error && <p className="error-note" role="alert">{error}</p>}
      {session.renders.map((render) => <RenderImage key={render.id} auth={auth} render={render} />)}
    </div>
  );
}
