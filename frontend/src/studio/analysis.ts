// Measures a layout and reviews it against common planning rules of thumb. Pure, so it is tested.
// Figures are typical residential planning guidance, not building code.

import type { Vec2 } from "../api/contracts";
import { footprint, polygonDistance, polygonsOverlap } from "../editor/geometry";
import { CATALOG_BY_ID, EXTERIOR_WALL, INTERIOR_WALL, ROOMS, WALLS, type CatalogItem, type PlacedItem, type Room } from "./apartment";

export const RULES = {
  walkwayCm: 90,
  sofaTableMinCm: 30,
  sofaTableMaxCm: 50,
  bedSideCm: 60,
  diningPullCm: 90,
  windowClearCm: 40,
  crowdedShare: 45,
};

export interface Solid {
  label: string;
  polygon: Vec2[];
}

function rectPolygon(minX: number, maxX: number, minZ: number, maxZ: number): Vec2[] {
  return [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
}

/** Wall pieces that block movement. Doors and passages are gaps; windows stay solid. */
export function wallSolids(): Solid[] {
  const solids: Solid[] = [];
  for (const wall of WALLS) {
    const half = (wall.exterior ? EXTERIOR_WALL : INTERIOR_WALL) / 2;
    const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
    const ux = (wall.b[0] - wall.a[0]) / length;
    const uz = (wall.b[1] - wall.a[1]) / length;
    const gaps = wall.openings.filter((o) => o.kind !== "window").sort((p, q) => p.from - q.from);
    let start = 0;
    for (const span of [...gaps, { from: length, to: length }]) {
      if (span.from > start) {
        const x1 = wall.a[0] + ux * start;
        const z1 = wall.a[1] + uz * start;
        const x2 = wall.a[0] + ux * span.from;
        const z2 = wall.a[1] + uz * span.from;
        solids.push({
          label: "the wall",
          polygon: rectPolygon(Math.min(x1, x2) - half * Math.abs(uz), Math.max(x1, x2) + half * Math.abs(uz), Math.min(z1, z2) - half * Math.abs(ux), Math.max(z1, z2) + half * Math.abs(ux)),
        });
      }
      start = span.to;
    }
  }
  return solids;
}

const WALL_SOLIDS = wallSolids();

export function itemOf(item: PlacedItem): CatalogItem {
  return CATALOG_BY_ID.get(item.catalogId)!;
}

export function itemPolygon(item: PlacedItem): Vec2[] {
  const [width, depth] = itemOf(item).size;
  return footprint(width, depth, { position: [item.x, item.z], yaw: item.yaw });
}

export function roomAt(x: number, z: number): Room | null {
  return ROOMS.find((room) => x >= room.rect[0] && x < room.rect[1] && z >= room.rect[2] && z < room.rect[3]) ?? null;
}

const isGhost = (item: PlacedItem) => {
  const data = itemOf(item);
  return data.role === "rug" || data.lift !== undefined;
};

function rayDistance(origin: Vec2, direction: Vec2, solids: Solid[], maxM = 8): { distance: number; label: string } | null {
  const STEP = 0.05;
  for (let travelled = STEP; travelled <= maxM; travelled += STEP) {
    const point: Vec2 = [origin[0] + direction[0] * travelled, origin[1] + direction[1] * travelled];
    const box: Vec2[] = [[point[0] - 0.01, point[1] - 0.01], [point[0] + 0.01, point[1] - 0.01], [point[0] + 0.01, point[1] + 0.01], [point[0] - 0.01, point[1] + 0.01]];
    const hit = solids.find((solid) => polygonsOverlap(box, solid.polygon));
    if (hit) return { distance: travelled, label: hit.label };
  }
  return null;
}

function othersAsSolids(items: PlacedItem[], except: PlacedItem): Solid[] {
  return items
    .filter((other) => other.uid !== except.uid && !isGhost(other))
    .map((other) => ({ label: itemOf(other).name.toLowerCase(), polygon: itemPolygon(other) }));
}

export interface ItemMetrics {
  roomName: string;
  footprintM2: number;
  roomSharePct: number;
  rotationDeg: number;
  nearestWallCm: number;
  nearest: { label: string; cm: number } | null;
  frontClearCm: number | null;
  overlaps: string[];
}

export function measureItem(item: PlacedItem, items: PlacedItem[]): ItemMetrics {
  const data = itemOf(item);
  const polygon = itemPolygon(item);
  const room = roomAt(item.x, item.z);
  const roomArea = room ? (room.rect[1] - room.rect[0]) * (room.rect[3] - room.rect[2]) : 1;
  const area = data.size[0] * data.size[1];

  const others = othersAsSolids(items, item);
  const overlaps = isGhost(item)
    ? []
    : [...others, ...WALL_SOLIDS].filter((solid) => polygonsOverlap(polygon, solid.polygon)).map((solid) => solid.label);

  const nearestWall = Math.min(...WALL_SOLIDS.map((solid) => polygonDistance(polygon, solid.polygon)));
  let nearest: ItemMetrics["nearest"] = null;
  for (const solid of others) {
    const distance = polygonDistance(polygon, solid.polygon);
    if (!nearest || distance * 100 < nearest.cm) nearest = { label: solid.label, cm: Math.round(distance * 100) };
  }

  const forward: Vec2 = [Math.sin(item.yaw), Math.cos(item.yaw)];
  const front: Vec2 = [item.x + (forward[0] * data.size[1]) / 2, item.z + (forward[1] * data.size[1]) / 2];
  const front2 = rayDistance(front, forward, [...others, ...WALL_SOLIDS]);

  const degrees = Math.round((item.yaw * 180) / Math.PI);
  return {
    roomName: room?.name ?? "Between rooms",
    footprintM2: Math.round(area * 100) / 100,
    roomSharePct: Math.round((area / roomArea) * 1000) / 10,
    rotationDeg: ((degrees % 360) + 360) % 360,
    nearestWallCm: Math.round(nearestWall * 100),
    nearest,
    frontClearCm: front2 ? Math.round(front2.distance * 100) : null,
    overlaps: [...new Set(overlaps)],
  };
}

export interface RoomSummary {
  id: string;
  name: string;
  areaM2: number;
  coveragePct: number;
  items: number;
}

export function summarizeRooms(items: PlacedItem[]): RoomSummary[] {
  return ROOMS.map((room) => {
    const inside = items.filter((item) => roomAt(item.x, item.z)?.id === room.id && itemOf(item).lift === undefined);
    const solid = inside.filter((item) => itemOf(item).role !== "rug");
    const area = (room.rect[1] - room.rect[0]) * (room.rect[3] - room.rect[2]);
    const used = solid.reduce((sum, item) => sum + itemOf(item).size[0] * itemOf(item).size[1], 0);
    return { id: room.id, name: room.name, areaM2: Math.round(area * 10) / 10, coveragePct: Math.round((used / area) * 100), items: inside.length };
  });
}

export type Severity = "fix" | "consider" | "good";

export interface ReviewNote {
  severity: Severity;
  title: string;
  detail: string;
  uid?: string;
}

function doorCenters(): { point: Vec2; label: string }[] {
  const centers: { point: Vec2; label: string }[] = [];
  for (const wall of WALLS) {
    const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
    const ux = (wall.b[0] - wall.a[0]) / length;
    const uz = (wall.b[1] - wall.a[1]) / length;
    for (const opening of wall.openings) {
      if (opening.kind === "window") continue;
      const middle = (opening.from + opening.to) / 2;
      centers.push({ point: [wall.a[0] + ux * middle, wall.a[1] + uz * middle], label: opening.kind === "door" ? "the door" : "the passage" });
    }
  }
  return centers;
}

/** Runs the built-in rules. Used directly and as the facts handed to the AI architect. */
export function reviewLayout(items: PlacedItem[]): ReviewNote[] {
  const notes: ReviewNote[] = [];
  const solidItems = items.filter((item) => !isGhost(item));

  for (const item of solidItems) {
    const metrics = measureItem(item, items);
    if (metrics.overlaps.length) {
      notes.push({ severity: "fix", uid: item.uid, title: `${itemOf(item).name} is blocked`, detail: `It overlaps ${metrics.overlaps.join(" and ")}. Move it until the outline clears.` });
    }
  }

  for (const { point, label } of doorCenters()) {
    let closest: { item: PlacedItem; cm: number } | null = null;
    for (const item of solidItems) {
      const cm = polygonDistance([[point[0] - 0.01, point[1] - 0.01], [point[0] + 0.01, point[1] - 0.01], [point[0] + 0.01, point[1] + 0.01], [point[0] - 0.01, point[1] + 0.01]], itemPolygon(item)) * 100;
      if (!closest || cm < closest.cm) closest = { item, cm };
    }
    if (closest && closest.cm < RULES.walkwayCm) {
      notes.push({ severity: closest.cm < 60 ? "fix" : "consider", uid: closest.item.uid, title: `Tight route at ${label}`, detail: `${itemOf(closest.item).name} is ${Math.round(closest.cm)} cm from ${label}. Aim for about ${RULES.walkwayCm} cm so people pass without turning sideways.` });
    }
  }

  for (const sofa of items.filter((item) => itemOf(item).role === "sofa")) {
    const tables = items.filter((item) => itemOf(item).role === "coffee" && roomAt(item.x, item.z)?.id === roomAt(sofa.x, sofa.z)?.id);
    if (!tables.length) continue;
    const gap = Math.min(...tables.map((table) => polygonDistance(itemPolygon(sofa), itemPolygon(table)))) * 100;
    if (gap < RULES.sofaTableMinCm) {
      notes.push({ severity: "consider", uid: sofa.uid, title: "Coffee table is close", detail: `${Math.round(gap)} cm from the sofa. ${RULES.sofaTableMinCm}–${RULES.sofaTableMaxCm} cm leaves knee room and still reaches.` });
    } else if (gap > 90) {
      notes.push({ severity: "consider", uid: sofa.uid, title: "Coffee table is out of reach", detail: `${Math.round(gap)} cm from the sofa. Bring it to ${RULES.sofaTableMinCm}–${RULES.sofaTableMaxCm} cm.` });
    } else if (gap <= RULES.sofaTableMaxCm) {
      notes.push({ severity: "good", uid: sofa.uid, title: "Sofa and table work well", detail: `${Math.round(gap)} cm apart, within the usual ${RULES.sofaTableMinCm}–${RULES.sofaTableMaxCm} cm.` });
    }
  }

  for (const bed of items.filter((item) => itemOf(item).role === "bed")) {
    const data = itemOf(bed);
    const blockers = [...othersAsSolids(items, bed), ...WALL_SOLIDS];
    const right: Vec2 = [Math.cos(bed.yaw), -Math.sin(bed.yaw)];
    const sides = [1, -1].map((sign) => {
      const direction: Vec2 = [right[0] * sign, right[1] * sign];
      const start: Vec2 = [bed.x + (direction[0] * data.size[0]) / 2, bed.z + (direction[1] * data.size[0]) / 2];
      return rayDistance(start, direction, blockers)?.distance ?? 8;
    });
    const tighter = Math.round(Math.min(...sides) * 100);
    if (tighter < RULES.bedSideCm) {
      notes.push({ severity: "consider", uid: bed.uid, title: "Bed access is narrow", detail: `${tighter} cm on the tighter side. Allow ${RULES.bedSideCm} cm to walk around and make the bed.` });
    }
  }

  for (const table of items.filter((item) => itemOf(item).role === "dining")) {
    const data = itemOf(table);
    const blockers = [...WALL_SOLIDS, ...othersAsSolids(items, table).filter((solid) => solid.label !== "dining chair")];
    const clear = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => {
      const angle = table.yaw + turn;
      const direction: Vec2 = [Math.sin(angle), Math.cos(angle)];
      const reach = (turn === 0 || turn === Math.PI ? data.size[1] : data.size[0]) / 2;
      const start: Vec2 = [table.x + direction[0] * reach, table.z + direction[1] * reach];
      return rayDistance(start, direction, blockers)?.distance ?? 8;
    });
    const tightest = Math.round(Math.min(...clear) * 100);
    if (tightest < RULES.diningPullCm) {
      notes.push({ severity: "consider", uid: table.uid, title: "Chairs need more room", detail: `${tightest} cm behind the table edge on its tightest side. ${RULES.diningPullCm} cm lets a chair pull out with someone passing.` });
    }
  }

  for (const summary of summarizeRooms(items)) {
    if (summary.coveragePct > RULES.crowdedShare) {
      notes.push({ severity: "consider", title: `${summary.name} is full`, detail: `Furniture covers ${summary.coveragePct}% of the floor. Under ${RULES.crowdedShare}% usually feels open.` });
    }
  }

  if (!notes.some((note) => note.severity !== "good")) {
    notes.push({ severity: "good", title: "Nothing is blocking", detail: "Routes, seating and bed access all meet the usual planning distances." });
  }
  const order: Record<Severity, number> = { fix: 0, consider: 1, good: 2 };
  return notes.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Everything the AI architect sees: measured numbers only, never images or personal data. */
export function layoutFacts(items: PlacedItem[]) {
  return {
    rooms: summarizeRooms(items).map(({ name, areaM2, coveragePct, items: count }) => ({ name, area_m2: areaM2, coverage_pct: coveragePct, items: count })),
    items: items.slice(0, 60).map((item) => {
      const metrics = measureItem(item, items);
      const [width, depth, height] = itemOf(item).size;
      return {
        name: itemOf(item).name,
        room: metrics.roomName,
        size_cm: [Math.round(width * 100), Math.round(depth * 100), Math.round(height * 100)],
        rotation_deg: metrics.rotationDeg,
        nearest_wall_cm: metrics.nearestWallCm,
        front_clear_cm: metrics.frontClearCm,
        overlaps: metrics.overlaps,
      };
    }),
    rule_findings: reviewLayout(items).slice(0, 20).map(({ severity, title, detail }) => ({ severity, title, detail })),
  };
}
