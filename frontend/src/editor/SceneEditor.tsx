// The editor's public interface: scene + asset URLs in, placement out.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Placement, SceneV1 } from "../api/contracts";
import { assertSceneV1 } from "../api/contracts";
import { EditorEngine, type ViewMode } from "./engine";

export interface SceneEditorHandle {
  setPlacement: (placement: Placement) => void;
  setView: (mode: ViewMode) => void;
  setBlocked: (blocked: boolean) => void;
  snapshot: () => Promise<Blob>;
}

interface Props {
  scene: SceneV1;
  assets: { room: string; furniture: string };
  headers: Record<string, string>;
  placement: Placement;
  onPlacement: (placement: Placement, final: boolean) => void;
  onWarning: (message: string) => void;
}

export const SceneEditor = forwardRef<SceneEditorHandle, Props>(function SceneEditor(
  { scene, assets, headers, placement, onPlacement, onWarning },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<EditorEngine | null>(null);
  const handlers = useRef({ onPlacement, onWarning });
  handlers.current = { onPlacement, onWarning };
  const initialPlacement = useRef(placement);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assertSceneV1(scene);
    const instance = new EditorEngine(host.current!, {
      onPlacement: (next, final) => handlers.current.onPlacement(next, final),
    });
    engine.current = instance;
    let alive = true;
    instance
      .load(scene, assets, headers, initialPlacement.current)
      .then((warning) => {
        if (!alive) return;
        if (warning) handlers.current.onWarning(warning);
        setLoading(false);
      })
      .catch(() => alive && handlers.current.onWarning("We could not load this 3D scene. Reload to try again."));
    return () => {
      alive = false;
      instance.dispose();
      engine.current = null;
    };
    // The scene is immutable for the life of this component; App remounts it on a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    setPlacement: (next) => engine.current?.setPlacement(next),
    setView: (mode) => engine.current?.setView(mode),
    setBlocked: (blocked) => engine.current?.setBlocked(blocked),
    snapshot: () => engine.current!.snapshot(),
  }), []);

  return (
    <div className="editor-canvas" ref={host} role="application" aria-label="3D room plan. Drag the sofa on the floor to move it.">
      {loading && <div className="editor-loading">Loading your room…</div>}
    </div>
  );
});
