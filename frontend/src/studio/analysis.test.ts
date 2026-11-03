import { describe, expect, it } from "vitest";
import { ROOMS, clampToRoom, startingLayout, type PlacedItem } from "./apartment";
import { itemPolygon, layoutFacts, measureItem, reviewLayout, roomAt, summarizeRooms, wallSolids } from "./analysis";

const place = (catalogId: string, x: number, z: number, yaw = 0, uid = catalogId): PlacedItem => ({ uid, catalogId, x, z, yaw });

describe("measureItem", () => {
  it("reports the room, size and share", () => {
    const sofa = place("sofa-fabric", 2.8, 2.0);
    const metrics = measureItem(sofa, [sofa]);
    expect(metrics.roomName).toBe("Living room");
    expect(metrics.footprintM2).toBeCloseTo(1.04, 2);
    expect(metrics.roomSharePct).toBeCloseTo(8, 0);
    expect(metrics.overlaps).toEqual([]);
  });

  it("measures clear floor in front of an item", () => {
    const sofa = place("sofa-fabric", 2.8, 1.0);
    const metrics = measureItem(sofa, [sofa]);
    // The sofa's front is at z = 1.33 and the wall to the bedroom is at z = 2.74.
    expect(metrics.frontClearCm).toBeGreaterThan(130);
    expect(metrics.frontClearCm).toBeLessThan(150);
  });

  it("flags an item pushed through a wall", () => {
    const sofa = place("sofa-fabric", 1.3, 1.0);
    expect(measureItem(sofa, [sofa]).overlaps).toContain("the wall");
  });

  it("flags two pieces of furniture sharing floor", () => {
    const sofa = place("sofa-fabric", 2.8, 2.0);
    const table = place("coffee-long", 2.8, 2.0);
    expect(measureItem(sofa, [sofa, table]).overlaps).toContain("low coffee table");
  });

  it("ignores rugs for overlap", () => {
    const sofa = place("sofa-fabric", 2.8, 2.0);
    const rug = place("rug", 2.8, 2.0);
    expect(measureItem(sofa, [sofa, rug]).overlaps).toEqual([]);
  });
});

describe("wall solids", () => {
  it("leaves doors open and keeps windows solid", () => {
    const solids = wallSolids();
    const covers = (x: number, z: number) => solids.some(({ polygon }) => {
      const xs = polygon.map((p) => p[0]);
      const zs = polygon.map((p) => p[1]);
      return x >= Math.min(...xs) && x <= Math.max(...xs) && z >= Math.min(...zs) && z <= Math.max(...zs);
    });
    expect(covers(1.2, 0.5)).toBe(false); // Door from the hall to the living room.
    expect(covers(5.94, 1.5)).toBe(true); // Living room window.
    expect(covers(3, 2.79)).toBe(true); // Wall between living room and bedroom.
  });
});

describe("reviewLayout", () => {
  it("calls out a coffee table that crowds the sofa", () => {
    const sofa = place("sofa-fabric", 2.8, 1.5);
    const table = place("coffee-long", 2.8, 2.15);
    const notes = reviewLayout([sofa, table]);
    expect(notes.some((note) => note.title === "Coffee table is close")).toBe(true);
  });

  it("praises a sofa and table at a working distance", () => {
    const sofa = place("sofa-fabric", 2.8, 1.5);
    const table = place("coffee-long", 2.8, 2.5);
    expect(reviewLayout([sofa, table]).some((note) => note.title === "Sofa and table work well")).toBe(true);
  });

  it("puts blocking problems first", () => {
    const notes = reviewLayout([place("sofa-fabric", 1.3, 1), place("coffee-long", 2.8, 2.5)]);
    expect(notes[0].severity).toBe("fix");
  });

  it("warns when furniture crowds a door", () => {
    const notes = reviewLayout([place("drawers", 1.7, 0.52, Math.PI / 2)]);
    expect(notes.some((note) => note.title.startsWith("Tight route"))).toBe(true);
  });

  it("gives an empty apartment a clean result", () => {
    expect(reviewLayout([])).toEqual([expect.objectContaining({ severity: "good", title: "Nothing is blocking" })]);
  });
});

describe("the sample apartment", () => {
  const layout = startingLayout();

  it("starts with every piece in a room and nothing through a wall", () => {
    for (const item of layout) {
      expect(roomAt(item.x, item.z), item.catalogId).not.toBeNull();
      const metrics = measureItem(item, layout);
      expect(metrics.overlaps.filter((label) => label === "the wall"), item.catalogId).toEqual([]);
    }
  });

  it("starts with nothing overlapping", () => {
    for (const item of layout) {
      expect(measureItem(item, layout).overlaps, item.catalogId).toEqual([]);
    }
  });

  it("covers all three rooms", () => {
    expect(summarizeRooms(layout).every((room) => room.items > 0)).toBe(true);
  });

  it("hands the architect measured facts only", () => {
    const facts = layoutFacts(layout);
    expect(facts.rooms).toHaveLength(3);
    expect(facts.items[0]).toHaveProperty("size_cm");
    expect(JSON.stringify(facts)).not.toContain("uid");
  });

  it("clamps a dragged item to the room's measured floor", () => {
    const room = ROOMS[0];
    const placed = clampToRoom({ catalogId: "sofa-fabric", x: 99, z: -99, yaw: 0 }, room);
    expect(placed.x).toBeCloseTo(room.rect[1] - 0.875, 3);
    expect(placed.z).toBeCloseTo(room.rect[2] + 0.42, 3);
    const turned = clampToRoom({ catalogId: "sofa-fabric", x: 99, z: 2, yaw: Math.PI / 2 }, room);
    expect(turned.x).toBeCloseTo(room.rect[1] - 0.42, 3);
  });

  it("keeps polygons the size of the catalog item", () => {
    const polygon = itemPolygon(place("bed", 3, 3));
    expect(Math.abs(polygon[1][0] - polygon[0][0])).toBeCloseTo(1.49, 2);
  });
});
