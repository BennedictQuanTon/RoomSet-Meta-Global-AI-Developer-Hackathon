// Lets a reload return to the same session. Storage can be unavailable, so failures are safe.

import type { Auth } from "../api/client";

const KEY = "roomset.session";

export function loadAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Auth) : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth: Auth | null): void {
  try {
    if (auth) localStorage.setItem(KEY, JSON.stringify(auth));
    else localStorage.removeItem(KEY);
  } catch {
    // The session simply won't survive a reload.
  }
}
