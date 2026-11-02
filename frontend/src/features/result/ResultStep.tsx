// The result screen: editor, controls, honest labels, saving and the style preview.

import { Box, CircleAlert, CircleCheck, ExternalLink, LayoutGrid, Move, MoveDiagonal, MoveHorizontal, MoveVertical, RotateCw, Save, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, type Auth } from "../../api/client";
import type { Capabilities, Placement, SessionView } from "../../api/contracts";
import { SceneEditor, type SceneEditorHandle } from "../../editor/SceneEditor";
import { checkPlacement } from "../../editor/geometry";
import { StylePanel } from "./StylePanel";

const RAD_TO_DEG = 180 / Math.PI;

interface Props {
  auth: Auth;
  session: SessionView;
  capabilities: Capabilities;
  onSession: (session: SessionView) => void;
  onStartOver: () => void;
}

export function ResultStep({ auth, session, capabilities, onSession, onStartOver }: Props) {
  const scene = session.scene!;
  const initial = session.placement ?? scene.furniture.placement;
  const editor = useRef<SceneEditorHandle>(null);
  const [placement, setPlacement] = useState<Placement>(initial);
  const [saved, setSaved] = useState<Placement>(initial);
  const [view, setView] = useState<"orbit" | "top">("orbit");
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${auth.token}` }), [auth.token]);
  const assets = useMemo(() => ({
    room: api.assetUrl(auth, scene.assets.room),
    furniture: api.assetUrl(auth, scene.assets.furniture),
  }), [auth, scene.assets]);

  const check = useMemo(() => checkPlacement(scene, placement), [scene, placement]);
  const dirty = JSON.stringify(placement) !== JSON.stringify(saved);
  const [width, height, depth] = scene.furniture.dimensions;
  const estimated = scene.calibration.status === "estimated";

  const blocked = check.overlaps.length > 0;
  useEffect(() => editor.current?.setBlocked(blocked), [blocked]);

  const place = (next: Placement) => {
    setPlacement(next);
    setMessage(null);
  };

  const rotate = (degrees: number) => {
    const next = { ...placement, yaw: Math.round(((degrees / RAD_TO_DEG)) * 1000) / 1000 };
    editor.current?.setPlacement(next);
    place(next);
  };

  const save = async () => {
    try {
      const next = await api.saveLayout(auth, placement);
      onSession(next);
      setSaved(placement);
      setMessage("Layout saved. You can return to this arrangement.");
    } catch (cause) {
      setMessage((cause as ApiError).message);
    }
  };

  const reset = () => {
    const start = scene.furniture.placement;
    editor.current?.setPlacement(start);
    place(start);
  };

  const switchView = (mode: "orbit" | "top") => {
    setView(mode);
    editor.current?.setView(mode);
  };

  return (
    <section className="result">
      <div className="editor-frame">
        <SceneEditor ref={editor} scene={scene} assets={assets} headers={headers} placement={initial}
          onPlacement={(next) => place(next)} onWarning={setWarning} />
        <div className="result-labels">
          {scene.provenance.method === "sample" && <span className="rs-badge">Sample room, not from your photos</span>}
          {scene.provenance.method === "assisted" && <span className="rs-badge">Room built using your confirmed measurements</span>}
          {scene.provenance.method === "automatic" && <span className="rs-badge">Room reconstructed from your photos</span>}
          {estimated && <span className="rs-badge">Estimated scale</span>}
          {scene.furniture.is_proxy && <span className="rs-badge">Dimensioned model</span>}
        </div>
        <div className="view-switch" role="group" aria-label="View">
          <button className={view === "orbit" ? "is-active" : ""} onClick={() => switchView("orbit")} aria-label="3D" title="3D"><Box size={20} strokeWidth={1.4} /></button>
          <button className={view === "top" ? "is-active" : ""} onClick={() => switchView("top")} aria-label="Top" title="Top"><LayoutGrid size={20} strokeWidth={1.4} /></button>
        </div>
        <p className="editor-hint"><Move size={16} strokeWidth={1.5} />Drag the sofa to move it. Drag anywhere else to look around.</p>
      </div>

      <div className="editor-panel">
        {warning && <p className="error-note" role="alert">{warning}</p>}

        <div className="panel-section">
          <p className="panel-name">{scene.furniture.name}</p>
          <dl className="panel-sizes">
            <div><dt><MoveHorizontal size={16} strokeWidth={1.5} />Width</dt><dd>{Math.round(width * 100)}</dd></div>
            <div><dt><MoveDiagonal size={16} strokeWidth={1.5} />Depth</dt><dd>{Math.round(depth * 100)}</dd></div>
            <div><dt><MoveVertical size={16} strokeWidth={1.5} />Height</dt><dd>{Math.round(height * 100)}</dd></div>
          </dl>
          <p className="plan-note">Centimeters. Shape and materials may differ from the product.</p>
        </div>

        <div className="panel-section">
          <div className="feedback" aria-live="polite">
            {check.overlaps.length > 0 && (
              <p className="plan-status feedback-bad"><CircleAlert size={20} strokeWidth={1.5} />The sofa overlaps {check.overlaps.join(" and ")}. Try moving it.</p>
            )}
            {check.outsideCaptured && <p className="plan-status feedback-warn"><TriangleAlert size={20} strokeWidth={1.5} />Not captured. Check this area before deciding.</p>}
            {check.overlaps.length === 0 && !check.outsideCaptured && <p className="plan-status feedback-ok"><CircleCheck size={20} strokeWidth={1.5} />Clear of everything modeled.</p>}
            {check.nearest && check.overlaps.length === 0 && (
              <p className="plan-note">
                {estimated ? "About " : ""}{Math.round(check.nearest.distance * 100)} cm from {check.nearest.label}{estimated ? ", estimated" : ""}.
              </p>
            )}
            {scene.warnings.map((text) => <p key={text} className="plan-note">{text}</p>)}
          </div>
          <div className="plan-field">
            <label className="plan-label" htmlFor="yaw"><RotateCw size={20} strokeWidth={1.5} />Rotate: {Math.round(placement.yaw * RAD_TO_DEG)}°</label>
            <input id="yaw" className="yaw" type="range" min={-180} max={180} step={5}
              value={Math.round(placement.yaw * RAD_TO_DEG)} onChange={(e) => rotate(Number(e.target.value))} />
          </div>
          <div className="plan-actions">
            <button className="plan-round" onClick={reset} aria-label="Reset" title="Reset"><Undo2 size={22} strokeWidth={1.5} /></button>
            {session.product?.source_url && (
              <a className="plan-round" href={session.product.source_url} target="_blank" rel="noreferrer noopener" aria-label="Back to the product" title="Back to the product"><ExternalLink size={22} strokeWidth={1.5} /></a>
            )}
            <button className="rs-button" onClick={save} disabled={!dirty}><Save size={20} strokeWidth={1.5} />Save layout</button>
          </div>
          {message && <p className="plan-note" role="status">{message}</p>}
        </div>

        <StylePanel auth={auth} session={session} enabled={capabilities.style_render}
          snapshot={() => editor.current!.snapshot()} onSession={onSession} />

        <div className="panel-section">
          <button className="link-button" onClick={onStartOver}><Trash2 size={18} strokeWidth={1.5} />Delete this plan and start over</button>
        </div>
      </div>
    </section>
  );
}
