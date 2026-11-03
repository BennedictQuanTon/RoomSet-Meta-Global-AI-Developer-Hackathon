// Opens a catalog piece in the phone's own AR viewer, at true size: AR Quick Look on iPhone, Scene Viewer on Android.

import type { CatalogItem } from "../../studio/apartment";

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

/** True-size placement: scaling is switched off so the piece cannot be shown bigger or smaller than it is. */
export function arHref(item: CatalogItem, support: ArSupport): string | null {
  if (!item.model || support === "none") return null;
  if (support === "quicklook") return `/studio/ar/${item.model}.usdz#allowsContentScaling=0`;
  const file = new URL(`/studio/models/${item.model}.glb`, window.location.origin).href;
  const params = new URLSearchParams({ file, mode: "ar_preferred", resizable: "false", title: item.name });
  const fallback = encodeURIComponent(window.location.href);
  return `intent://arvr.google.com/scene-viewer/1.2?${params}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`;
}

export const sizeLabel = (item: CatalogItem) => item.size.map((metres) => Math.round(metres * 100)).join(" × ");
