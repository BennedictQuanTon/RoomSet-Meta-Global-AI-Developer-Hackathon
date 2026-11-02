// The studio page: step into three real rooms, or see the whole apartment as a model.

import {
  ArrowUpRight, Box, Compass, Copy, Eye, LayoutGrid, Minus, Plus, RotateCcw, RotateCw, Trash2, Undo2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { navigate } from "../app/nav";
import { layoutFacts, measureItem, reviewLayout, itemOf, summarizeRooms, type ReviewNote } from "./analysis";
import { CATALOG, CATEGORIES, ROOMS, ROOM_BY_ID, clampToRoom, startingLayout, type CatalogItem, type PlacedItem } from "./apartment";
import type { StudioEngine, StudioMode } from "./engine";
import "./studio.css";

const STORAGE_KEY = "roomset.studio.v2";
const ROTATE_STEP = Math.PI / 12;

function loadLayout(): PlacedItem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as PlacedItem[] | null;
    if (Array.isArray(saved) && saved.every((item) => CATALOG.some((entry) => entry.id === item.catalogId))) return saved;
  } catch {
    // Falls back to the starting layout.
  }
  return startingLayout();
}

function saveLayout(items: PlacedItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // The layout simply won't survive a reload.
  }
}

function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button className={active ? "st-icon is-active" : "st-icon"} onClick={onClick} aria-label={label} aria-pressed={active} title={label}>
      {children}
    </button>
  );
}

interface AiAdvice {
  summary: string;
  notes: { title: string; detail: string }[];
  model: string;
}

export function Studio() {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<EditorHandle | null>(null);
  const labels = useRef(new Map<string, HTMLDivElement>());
  const [items, setItems] = useState<PlacedItem[]>(loadLayout);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [mode, setMode] = useState<StudioMode>("room");
  const [roomId, setRoomId] = useState(ROOMS[0].id);
  const [panel, setPanel] = useState<"none" | "catalog" | "advisor">("none");
  const [progress, setProgress] = useState({ loaded: 0, total: 1 });
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let instance: StudioEngine | null = null;
    let cancelled = false;
    void import("./engine")
      .then(async ({ StudioEngine: Engine }) => {
        if (cancelled) return;
        instance = new Engine(host.current!, {
          onSelect: setSelectedUid,
          onItemsChange: (next, final) => {
            setItems(next);
            if (final) saveLayout(next);
          },
          onProgress: (loaded, total) => setProgress({ loaded, total }),
        });
        engine.current = instance;
        void instance.loadLighting();
        await instance.setItems(items);
        instance.setMode("room", ROOMS[0].id);
        if (!cancelled) setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      instance?.dispose();
      engine.current = null;
    };
    // The engine owns the scene for the life of the page; later changes go through commit().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback((next: PlacedItem[]) => {
    setItems(next);
    saveLayout(next);
    void engine.current?.setItems(next);
  }, []);

  const go = useCallback((nextMode: StudioMode, nextRoom?: string) => {
    setMode(nextMode);
    if (nextRoom) setRoomId(nextRoom);
    engine.current?.setMode(nextMode, nextRoom);
  }, []);

  const selected = items.find((item) => item.uid === selectedUid) ?? null;
  const metrics = useMemo(() => (selected ? measureItem(selected, items) : null), [selected, items]);
  const notes = useMemo(() => (panel === "advisor" ? reviewLayout(items) : []), [panel, items]);
  const rooms = useMemo(() => summarizeRooms(items), [items]);

  const addItem = (entry: CatalogItem) => {
    const room = ROOM_BY_ID.get(roomId)!;
    const placed = clampToRoom({ catalogId: entry.id, x: room.origin[0] + 0.8, z: room.origin[1] - 0.9, yaw: 0 }, room);
    const uid = `item-${Date.now().toString(36)}`;
    commit([...items, { uid, catalogId: entry.id, yaw: 0, ...placed }]);
    setPanel("none");
    window.setTimeout(() => engine.current?.frameItem(uid), 400);
  };

  const rotate = (direction: number) => {
    if (!selected) return;
    const yaw = selected.yaw + direction * ROTATE_STEP;
    const room = ROOMS.find((entry) => selected.x >= entry.rect[0] && selected.x < entry.rect[1] && selected.z >= entry.rect[2] && selected.z < entry.rect[3]);
    const placed = room ? clampToRoom({ ...selected, yaw }, room) : selected;
    commit(items.map((item) => (item.uid === selected.uid ? { ...item, yaw, x: placed.x, z: placed.z } : item)));
  };

  const duplicate = () => {
    if (!selected) return;
    const room = ROOMS.find((entry) => selected.x >= entry.rect[0] && selected.x < entry.rect[1] && selected.z >= entry.rect[2] && selected.z < entry.rect[3]) ?? ROOM_BY_ID.get(roomId)!;
    const uid = `item-${Date.now().toString(36)}`;
    const placed = clampToRoom({ ...selected, x: selected.x + 0.4, z: selected.z + 0.4 }, room);
    commit([...items, { ...selected, uid, ...placed }]);
    window.setTimeout(() => engine.current?.select(uid), 200);
  };

  const remove = () => {
    if (!selected) return;
    commit(items.filter((item) => item.uid !== selected.uid));
    engine.current?.select(null);
  };

  const reset = () => {
    commit(startingLayout());
    engine.current?.select(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName === "INPUT") return;
      if (event.key === "Escape") {
        engine.current?.select(null);
        setPanel("none");
      }
      if (!selected) return;
      if (event.key === "Delete" || event.key === "Backspace") remove();
      if (event.key.toLowerCase() === "r") rotate(event.shiftKey ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const instance = engine.current;
    if (!instance || !ready) return;
    instance.clearLabels();
    if (mode !== "room") {
      for (const room of ROOMS) {
        const element = labels.current.get(room.id);
        if (element) instance.registerLabel(element, (room.rect[0] + room.rect[1]) / 2, (room.rect[2] + room.rect[3]) / 2);
      }
    }
  }, [mode, ready]);

  const room = ROOM_BY_ID.get(roomId)!;
  const roomSummary = rooms.find((entry) => entry.id === roomId);

  return (
    <div className="st">
      <div className="st-stage" ref={host} role="application" aria-label="A 3D apartment with real photographed rooms and movable furniture. Drag a piece to move it. Drag elsewhere to orbit." />

      {mode !== "room" && (
        <div className="st-labels" aria-hidden="true">
          {rooms.map((entry) => (
            <div key={entry.id} ref={(element) => { if (element) labels.current.set(entry.id, element); }} className="st-label">
              <b>{entry.name}</b><span>{entry.areaM2} m²</span>
            </div>
          ))}
        </div>
      )}

      {!ready && (
        <div className="st-loading" role="status">
          <img src="/brand/logo-dark.png" alt="" width={150} />
          {failed ? <p>3D could not start on this device.</p> : (
            <div className="st-loading-track"><span style={{ transform: `scaleX(${progress.loaded / Math.max(progress.total, 1)})` }} /></div>
          )}
        </div>
      )}

      <header className="st-top">
        <a href="/" className="st-logo" onClick={(event) => { event.preventDefault(); navigate("/"); }} aria-label="Roomset home">
          <img src="/brand/logo-light.png" alt="roomset" />
        </a>
        <nav className="st-rooms" aria-label="Rooms">
          {ROOMS.map((entry) => (
            <button key={entry.id} className={mode === "room" && roomId === entry.id ? "is-active" : ""} onClick={() => go("room", entry.id)}>{entry.name}</button>
          ))}
        </nav>
        <div className="st-end">
          <a href="/start" onClick={(event) => { event.preventDefault(); navigate("/start"); }}>All options</a>
          <a href="/app" onClick={(event) => { event.preventDefault(); navigate("/app"); }}>Plan my own room <ArrowUpRight size={16} strokeWidth={1.5} /></a>
        </div>
      </header>

      <aside className="st-rail" aria-label="Tools">
        <IconButton label="In the room" active={mode === "room"} onClick={() => go("room", roomId)}><Eye size={20} strokeWidth={1.4} /></IconButton>
        <IconButton label="Whole apartment" active={mode === "model"} onClick={() => go("model")}><Box size={20} strokeWidth={1.4} /></IconButton>
        <IconButton label="Top-down plan" active={mode === "plan"} onClick={() => go("plan")}><LayoutGrid size={20} strokeWidth={1.4} /></IconButton>
        <span className="st-rail-gap" />
        <IconButton label="Add furniture" active={panel === "catalog"} onClick={() => setPanel(panel === "catalog" ? "none" : "catalog")}><Plus size={20} strokeWidth={1.4} /></IconButton>
        <IconButton label="Ask the architect" active={panel === "advisor"} onClick={() => setPanel(panel === "advisor" ? "none" : "advisor")}><Compass size={20} strokeWidth={1.4} /></IconButton>
        <IconButton label="Reset the layout" onClick={reset}><Undo2 size={20} strokeWidth={1.4} /></IconButton>
        <span className="st-rail-gap" />
        <IconButton label="Zoom in" onClick={() => engine.current?.zoomBy(-5)}><Plus size={16} strokeWidth={1.4} /></IconButton>
        <IconButton label="Zoom out" onClick={() => engine.current?.zoomBy(5)}><Minus size={16} strokeWidth={1.4} /></IconButton>
      </aside>

      {mode === "room" && roomSummary && !selected && panel === "none" && (
        <footer className="st-caption">
          <span className="st-caption-name">{room.name}</span>
          <span>{roomSummary.areaM2} m²</span>
          <span>{roomSummary.items} pieces</span>
          <span>{roomSummary.coveragePct}% floor used</span>
          <span className="st-caption-hint">Drag furniture to move it. Drag anywhere else to orbit. Scroll to zoom.</span>
        </footer>
      )}

      {selected && metrics && panel === "none" && (
        <section className="st-panel st-inspector" aria-label={`${itemOf(selected).name} details`}>
          <header>
            {itemOf(selected).model && <img src={`/studio/thumbs/${itemOf(selected).model}.webp`} alt="" width={72} height={72} />}
            <div>
              <h2>{itemOf(selected).name}</h2>
              <p>{metrics.roomName}</p>
            </div>
            <button className="st-close" onClick={() => engine.current?.select(null)} aria-label="Close"><X size={18} strokeWidth={1.4} /></button>
          </header>
          <dl className="st-dims">
            {(["Width", "Depth", "Height"] as const).map((label, index) => (
              <div key={label}><dd>{Math.round(itemOf(selected).size[index] * 100)}</dd><dt>{label} cm</dt></div>
            ))}
          </dl>
          <dl className="st-metrics">
            <div><dt>Floor it takes</dt><dd>{metrics.footprintM2} m² · {metrics.roomSharePct}%</dd></div>
            <div><dt>Nearest wall</dt><dd>{metrics.nearestWallCm} cm</dd></div>
            <div><dt>Clear in front</dt><dd>{metrics.frontClearCm === null ? "Open" : `${metrics.frontClearCm} cm`}</dd></div>
            {metrics.nearest && <div><dt>Closest piece</dt><dd>{metrics.nearest.cm} cm</dd></div>}
            <div><dt>Facing</dt><dd>{metrics.rotationDeg}°</dd></div>
          </dl>
          {metrics.overlaps.length > 0 && <p className="st-alert">Overlaps {metrics.overlaps.join(" and ")}.</p>}
          <div className="st-actions">
            <IconButton label="Rotate left" onClick={() => rotate(1)}><RotateCcw size={18} strokeWidth={1.4} /></IconButton>
            <IconButton label="Rotate right" onClick={() => rotate(-1)}><RotateCw size={18} strokeWidth={1.4} /></IconButton>
            <IconButton label="Duplicate" onClick={duplicate}><Copy size={18} strokeWidth={1.4} /></IconButton>
            <IconButton label="Remove" onClick={remove}><Trash2 size={18} strokeWidth={1.4} /></IconButton>
          </div>
        </section>
      )}

      {panel === "catalog" && (
        <section className="st-panel st-catalog" aria-label="Add furniture">
          <header>
            <div><h2>Add to the {room.name.toLowerCase()}</h2><p>Real-world sizes. Models are samples.</p></div>
            <button className="st-close" onClick={() => setPanel("none")} aria-label="Close"><X size={18} strokeWidth={1.4} /></button>
          </header>
          <div className="st-catalog-scroll" data-lenis-prevent>
            {CATEGORIES.map((category) => (
              <div key={category}>
                <h3>{category}</h3>
                <ul>
                  {CATALOG.filter((entry) => entry.category === category).map((entry) => (
                    <li key={entry.id}>
                      <button onClick={() => addItem(entry)}>
                        <span className="st-thumb">{entry.model && <img src={`/studio/thumbs/${entry.model}.webp`} alt="" loading="lazy" />}</span>
                        <b>{entry.name}</b>
                        <span>{Math.round(entry.size[0] * 100)} × {Math.round(entry.size[1] * 100)} cm</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {panel === "advisor" && (
        <Advisor notes={notes} items={items} onClose={() => setPanel("none")} onSelect={(uid) => {
          setPanel("none");
          engine.current?.frameItem(uid);
        }} />
      )}
    </div>
  );
}

type EditorHandle = StudioEngine;

function Advisor({ notes, items, onClose, onSelect }: { notes: ReviewNote[]; items: PlacedItem[]; onClose: () => void; onSelect: (uid: string) => void }) {
  const [state, setState] = useState<"idle" | "asking" | "off" | "error">("idle");
  const [advice, setAdvice] = useState<AiAdvice | null>(null);

  const ask = async () => {
    setState("asking");
    try {
      const response = await fetch("/api/studio/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layoutFacts(items)),
      });
      if (response.status === 503 || response.status === 404 || response.status === 405) {
        setState("off");
        return;
      }
      if (!response.ok) throw new Error("failed");
      setAdvice((await response.json()) as AiAdvice);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <section className="st-panel st-advisor" aria-label="Architect review">
      <header>
        <div><h2>Architect's review</h2><p>Measured from this layout</p></div>
        <button className="st-close" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={1.4} /></button>
      </header>
      <div className="st-catalog-scroll" data-lenis-prevent>
        {advice && (
          <div className="st-ai">
            <p className="st-ai-summary">{advice.summary}</p>
            {advice.notes.map((note) => (
              <article key={note.title}><h3>{note.title}</h3><p>{note.detail}</p></article>
            ))}
            <p className="st-source">Written by Muse Spark from the numbers below. Suggestions only, not a survey.</p>
          </div>
        )}
        <ul className="st-notes">
          {notes.map((note) => (
            <li key={note.title + note.detail} className={`st-note st-note--${note.severity}`}>
              <button disabled={!note.uid} onClick={() => note.uid && onSelect(note.uid)}>
                <b>{note.title}</b>
                <span>{note.detail}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="st-source">Checked against common residential planning distances. Rules of thumb, not building code.</p>
      </div>
      <div className="st-advisor-foot">
        <button className="st-primary" onClick={ask} disabled={state === "asking"}>
          <Compass size={16} strokeWidth={1.5} /> {state === "asking" ? "Reading your layout…" : advice ? "Ask again" : "Ask the AI architect"}
        </button>
        {state === "off" && <p className="st-source">The AI architect isn't switched on yet. The review above still applies.</p>}
        {state === "error" && <p className="st-source">The architect didn't answer. Try again in a minute.</p>}
      </div>
    </section>
  );
}
