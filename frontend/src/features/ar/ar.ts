// Opens a catalog piece in the phone's own AR viewer, at true size: AR Quick Look on iPhone, Scene Viewer on Android.

import type { CatalogItem } from "../../studio/apartment";
import SETS from "./sets.generated.json";

export interface RoomSet {
  id: string;
  name: string;
  /** Every piece, repeats included. */
  count: number;
  /** Names, with repeats folded: "4 × Dining chair". */
  pieces: string[];
  /** Width, depth, height in metres, measured from the built file. */
  size: [number, number, number];
  kb: number;
}

export const ROOM_SETS = SETS as RoomSet[];

export type ArSupport = "quicklook" | "sceneviewer" | "none";

let cached: ArSupport | null = null;

export function arSupport(): ArSupport {
  if (cached) return cached;
  const anchor = document.createElement("a");
  if (anchor.relList?.supports?.("ar")) cached = "quicklook";
  else if (/android/i.test(navigator.userAgent)) cached = "sceneviewer";
  else cached = "none";
  return cached;
}

/**
 * AR Quick Look options: scaling off keeps true size, and the banner shows the name and size
 * while the piece stands in the room.
 */
function quickLook(file: string, title: string, subtitle: string): string {
  const banner = new URLSearchParams({ allowsContentScaling: "0", checkoutTitle: title, checkoutSubtitle: subtitle });
  return `${file}#${banner.toString().replace(/\+/g, "%20")}`;
}

/** True-size placement: scaling is switched off so the piece cannot be shown bigger or smaller than it is. */
export function arHref(item: CatalogItem, support: ArSupport): string | null {
  if (!item.model || support === "none") return null;
  if (support === "quicklook") return quickLook(`/studio/ar/${item.model}.usdz`, item.name, `${dimensions(item)} · true size`);
  const file = new URL(`/studio/models/${item.model}.glb`, window.location.origin).href;
  const params = new URLSearchParams({ file, mode: "ar_preferred", resizable: "false", title: item.name });
  const fallback = encodeURIComponent(window.location.href);
  return `intent://arvr.google.com/scene-viewer/1.2?${params}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`;
}

/** Room sets exist as USDZ only, so they open on iPhone and iPad. */
export function setHref(set: RoomSet, support: ArSupport): string | null {
  if (support !== "quicklook") return null;
  const [width, depth] = set.size.map((metres) => (Math.round(metres * 10) / 10).toFixed(1));
  return quickLook(`/studio/ar/sets/${set.id}.usdz`, set.name, `${set.count} pieces · ${width} × ${depth} m floor`);
}

/** "W 157 × D 66 × H 80 cm" */
const dimensions = (item: CatalogItem) => {
  const [width, depth, height] = item.size.map((metres) => Math.round(metres * 100));
  return `W ${width} × D ${depth} × H ${height} cm`;
};

export const sizeLabel = (item: CatalogItem) => item.size.map((metres) => Math.round(metres * 100)).join(" × ");
