import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/fixtures/scene.fixture.json";
import type { SceneV1, Vec2 } from "../api/contracts";
import { checkPlacement, footprint, polygonDistance, polygonsOverlap, wallPolygon } from "./geometry";

const scene = fixture as unknown as SceneV1;
const noWalls = { ...scene, obstacles: [] };

describe("footprint", () => {
  it("keeps outer size under any rotation", () => {
    const corners = footprint(2, 1, { position: [3, 3], yaw: 0.7 });
    expect(Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1])).toBeCloseTo(2);
    expect(Math.hypot(corners[2][0] - corners[1][0], corners[2][1] - corners[1][1])).toBeCloseTo(1);
  });

  it("matches Three.js rotation.y: +90 degrees sends local +X to world -Z", () => {
    const [, right] = footprint(2, 0, { position: [0, 0], yaw: Math.PI / 2 });
    expect(right[0]).toBeCloseTo(0);
    expect(right[1]).toBeCloseTo(-1);
  });
});

describe("overlap and distance", () => {
  const square = (x: number, z: number): Vec2[] => [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]];

  it("detects real overlap and ignores touching", () => {
    expect(polygonsOverlap(square(0, 0), square(0.5, 0.5))).toBe(true);
    expect(polygonsOverlap(square(0, 0), square(1, 0))).toBe(false);
    expect(polygonsOverlap(square(0, 0), square(3, 0))).toBe(false);
  });

  it("measures the gap between shapes", () => {
    expect(polygonDistance(square(0, 0), square(3, 0))).toBeCloseTo(2);
    expect(polygonDistance(square(0, 0), square(0.5, 0.5))).toBe(0);
  });

  it("extends wall thickness away from the room", () => {
    const zs = wallPolygon(scene.walls[0]).map((p) => p[1]);
    expect(Math.min(...zs)).toBeCloseTo(-0.1);
    expect(Math.max(...zs)).toBeCloseTo(0);
    const xs = wallPolygon(scene.walls[1]).map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(-0.1);
    expect(Math.max(...xs)).toBeCloseTo(0);
  });
});

describe("checkPlacement", () => {
  it("passes a sofa standing clear inside the floor", () => {
    const check = checkPlacement(noWalls, { position: [2.1, 1.6], yaw: 0 });
    expect(check.overlaps).toEqual([]);
    expect(check.outsideCaptured).toBe(false);
    expect(check.nearest?.distance).toBeGreaterThan(0.5);
  });

  it("flags a wall overlap", () => {
    const check = checkPlacement(noWalls, { position: [2.1, 0.2], yaw: 0 });
    expect(check.overlaps).toContain("wall A");
  });

  it("flags an obstacle overlap by its label", () => {
    const check = checkPlacement(scene, { position: [3.2, 0.5], yaw: 0 });
    expect(check.overlaps).toContain("Plant");
  });

  it("never treats space beyond the captured floor as verified free space", () => {
    const check = checkPlacement(noWalls, { position: [4.0, 1.6], yaw: 0 });
    expect(check.overlaps).toEqual([]);
    expect(check.outsideCaptured).toBe(true);
  });
});
