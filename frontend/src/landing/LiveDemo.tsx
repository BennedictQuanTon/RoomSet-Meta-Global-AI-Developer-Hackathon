// The real editor engine in a real photographed room. Controls sit below the image, never on it.

import { useEffect, useRef, useState } from "react";
import type { Placement, SceneV1 } from "../api/contracts";
import type { Backdrop, EditorEngine } from "../editor/engine";

const SCENE: SceneV1 = {
  schema_version: "scene.v1",
  units: "meters",
  up: "Y",
  floor: [[-2.2, -4], [2.2, -4], [2.2, -1.4], [-2.2, -1.4]],
  walls: [],
  obstacles: [],
  calibration: { status: "estimated", method: "demo", reference_distance_m: null },
  provenance: { method: "sample", builder: "demo", reconstruction_model: null, created_at: "2026-11-02T00:00:00Z", notes: [] },
  furniture: { id: "sofa", name: "Sample sofa", dimensions: [1.57, 0.8, 0.66], is_proxy: true, placement: { position: [0, -3], yaw: 0 } },
  assets: { room: "", furniture: "/demo/sofa.glb" },
  source_photos: [],
  warnings: [],
};

const BACKDROP: Backdrop = {
  panorama: "/demo/room.jpg",
  captureHeight: 1.45,
  rotation: 0,
  sunDirection: [3.2, 5, 1.2],
  bounds: [-2.2, 2.2, -4, -1.4],
};

const START = SCENE.furniture.placement;
const RAD_TO_DEG = 180 / Math.PI;

export function LiveDemo() {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<EditorEngine | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [placement, setPlacement] = useState<Placement>(START);
  const [width, height, depth] = SCENE.furniture.dimensions;

  useEffect(() => {
    const element = host.current!;
    let instance: EditorEngine | null = null;
    let cancelled = false;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setState("loading");
        try {
          const { EditorEngine: Engine } = await import("../editor/engine");
          if (cancelled) return;
          instance = new Engine(element, { onPlacement: (next) => setPlacement(next) });
          engine.current = instance;
          await instance.load(SCENE, { furniture: SCENE.assets.furniture }, START, { environment: "/demo/env.hdr", backdrop: BACKDROP });
          if (!cancelled) setState("ready");
        } catch {
          if (!cancelled) setState("failed");
        }
      },
      { rootMargin: "500px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      instance?.dispose();
      engine.current = null;
    };
  }, []);

  const rotate = (degrees: number) => {
    const next = { ...placement, yaw: Math.round((degrees / RAD_TO_DEG) * 1000) / 1000 };
    engine.current?.setPlacement(next);
    setPlacement(next);
  };
  const reset = () => {
    engine.current?.setPlacement(START);
    setPlacement(START);
    engine.current?.lookAtSofa();
  };

  return (
    <div className="lp-demo">
      <div className="lp-demo-stage" ref={host} role="application" aria-label="A sofa in a photographed room. Drag the sofa to move it. Drag elsewhere to look around.">
        {state !== "ready" && (
          <div className="lp-demo-wait t-caption">{state === "failed" ? "3D could not start on this device." : "Loading the room"}</div>
        )}
      </div>
      <div className="lp-demo-controls">
        <div>
          <p className="t-caption">Rotate {Math.round(placement.yaw * RAD_TO_DEG)}°</p>
          <input className="lp-range" aria-label="Rotate the sofa" type="range" min={-180} max={180} step={5} value={Math.round(placement.yaw * RAD_TO_DEG)} onChange={(event) => rotate(Number(event.target.value))} />
        </div>
        <div className="lp-demo-actions">
          <button className="lp-pill" onClick={() => engine.current?.lookAtSofa()}>Find the sofa</button>
          <button className="lp-pill" onClick={reset}>Reset</button>
        </div>
        <div aria-live="polite">
          <p className="t-caption">{Math.round(width * 100)} W × {Math.round(depth * 100)} D × {Math.round(height * 100)} H cm</p>
          <p className="t-caption lp-muted">X {placement.position[0].toFixed(2)} m / Z {(-placement.position[1]).toFixed(2)} m from the camera</p>
        </div>
      </div>
      <p className="t-caption lp-muted lp-demo-note">Drag the sofa across the floor. Drag the room to look around. Scroll to zoom. This sample room is a photograph; the app builds yours from your measurements.</p>
    </div>
  );
}
