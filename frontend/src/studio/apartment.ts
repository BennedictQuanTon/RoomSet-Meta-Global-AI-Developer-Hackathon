// The sample apartment: a real room photographed in 360° in three finishes, assembled into a three-room
// plan. Sizes come from fitting a box to the walls, floor and ceiling in the photos, using the door
// height to set the camera height. Meters, floor on XZ. All assets are CC0 from Poly Haven.

import type { Vec2 } from "../api/contracts";
import data from "./apartment.data.json";

export const ROOM_HEIGHT = 2.5;
export const INTERIOR_WALL = 0.1;
export const EXTERIOR_WALL = 0.16;
export const HALL_WIDTH = 1.2;
/** Plan walls straddle the measured room edges, so furniture keeps this far inside them. */
const WALL_MARGIN = 0.09;
export const APARTMENT = { width: 5.94, depth: 8.37 };

export type FloorKind = "parquet" | "wood" | "stone";

export interface Room {
  id: string;
  name: string;
  /** Poly Haven panorama of this real room. */
  pano: string;
  /** Height the panorama was shot from, in meters. */
  captureHeight: number;
  /** World position of the panorama's capture point. */
  origin: Vec2;
  /** Measured floor in world coordinates: minX, maxX, minZ, maxZ. */
  rect: [number, number, number, number];
  floor: FloorKind;
  /** Radians that turn this room's axes to line up with its photo. */
  photoRotation: number;
}

export const ROOMS: Room[] = data.rooms.map((room) => ({
  id: room.id,
  name: room.name,
  pano: room.pano,
  captureHeight: room.captureHeight,
  origin: room.origin as Vec2,
  rect: [room.origin[0] + room.local[0], room.origin[0] + room.local[1], room.origin[1] + room.local[2], room.origin[1] + room.local[3]],
  floor: room.floor as FloorKind,
  photoRotation: (40 * Math.PI) / 180,
}));

export const ROOM_BY_ID = new Map(ROOMS.map((room) => [room.id, room]));

export interface Opening {
  from: number;
  to: number;
  kind: "door" | "window" | "passage";
  sill?: number;
  head?: number;
}

export interface WallDef {
  id: string;
  a: Vec2;
  b: Vec2;
  exterior: boolean;
  /** Outward direction for exterior walls, used to cut away the side nearest the camera. */
  outward?: Vec2;
  openings: Opening[];
}

// A simplified plan: the rooms side by side along a hall. Each has its door on the hall side, as in the photo.
const DOORS = ROOMS.map((room) => ({ from: room.rect[2] + 0.07, to: room.rect[2] + 0.97, kind: "door" as const }));

export const WALLS: WallDef[] = [
  { id: "north", a: [0, 0], b: [APARTMENT.width, 0], exterior: true, outward: [0, -1], openings: [] },
  {
    id: "east",
    a: [APARTMENT.width, 0],
    b: [APARTMENT.width, APARTMENT.depth],
    exterior: true,
    outward: [1, 0],
    openings: ROOMS.map((room) => ({ from: room.origin[1] - 0.6, to: room.origin[1] + 0.75, kind: "window" as const, sill: 0.08, head: 2.3 })),
  },
  { id: "south", a: [0, APARTMENT.depth], b: [APARTMENT.width, APARTMENT.depth], exterior: true, outward: [0, 1], openings: [] },
  { id: "west", a: [0, 0], b: [0, APARTMENT.depth], exterior: true, outward: [-1, 0], openings: [{ from: 3.7, to: 4.6, kind: "door" }] },
  { id: "hall", a: [HALL_WIDTH, 0], b: [HALL_WIDTH, APARTMENT.depth], exterior: false, openings: DOORS },
  { id: "living-bedroom", a: [HALL_WIDTH, 2.79], b: [APARTMENT.width, 2.79], exterior: false, openings: [] },
  { id: "bedroom-dining", a: [HALL_WIDTH, 5.58], b: [APARTMENT.width, 5.58], exterior: false, openings: [] },
];

export type Category = "Seating" | "Tables" | "Sleep" | "Storage" | "Accents";
export type Role = "sofa" | "chair" | "coffee" | "table" | "dining" | "bed" | "storage" | "tall" | "plant" | "rug" | "lamp";

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  role: Role;
  /** Width (X), depth (Z), height (Y) in meters, from the model's real-world scale. */
  size: [number, number, number];
  model?: string;
  /** Degrees that turn the model so its size matches width on X and depth on Z. */
  yawOffset?: number;
  /** Sits on another piece of furniture. */
  lift?: number;
}

export const CATALOG = data.catalog as CatalogItem[];
export const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]));
export const CATEGORIES: Category[] = ["Seating", "Tables", "Sleep", "Storage", "Accents"];

export interface PlacedItem {
  uid: string;
  catalogId: string;
  x: number;
  z: number;
  yaw: number;
}

export function startingLayout(): PlacedItem[] {
  return data.start.map((entry, index) => {
    const room = ROOM_BY_ID.get(entry.room)!;
    const yaw = (entry.yaw * Math.PI) / 180;
    const placed = clampToRoom({ catalogId: entry.id, x: room.origin[0] + entry.x, z: room.origin[1] + entry.z, yaw }, room);
    return { uid: `start-${index}`, catalogId: entry.id, x: Math.round(placed.x * 1000) / 1000, z: Math.round(placed.z * 1000) / 1000, yaw };
  });
}

/** Keeps an item's whole rotated footprint on a room's measured floor. */
export function clampToRoom(item: Pick<PlacedItem, "catalogId" | "x" | "z" | "yaw">, room: Room): { x: number; z: number } {
  const [width, depth] = CATALOG_BY_ID.get(item.catalogId)!.size;
  const margin = WALL_MARGIN;
  const cos = Math.abs(Math.cos(item.yaw));
  const sin = Math.abs(Math.sin(item.yaw));
  const halfX = Math.min((width / 2) * cos + (depth / 2) * sin + margin, (room.rect[1] - room.rect[0]) / 2);
  const halfZ = Math.min((width / 2) * sin + (depth / 2) * cos + margin, (room.rect[3] - room.rect[2]) / 2);
  return {
    x: Math.max(room.rect[0] + halfX, Math.min(room.rect[1] - halfX, item.x)),
    z: Math.max(room.rect[2] + halfZ, Math.min(room.rect[3] - halfZ, item.z)),
  };
}
