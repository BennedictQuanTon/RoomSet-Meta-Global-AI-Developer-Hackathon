// Page changes go through Root, so every move between the landing page and the app gets the transition.

const EVENT = "roomset:navigate";

export const APP_PATH = import.meta.env.VITE_TRY_URL ?? "/start";

let transition: Promise<void> = Promise.resolve();

/** Resolves when the page transition has finished, so heavy work can wait instead of making it stutter. */
export function afterTransition(): Promise<void> {
  return transition;
}

export function trackTransition(done: Promise<void>): void {
  transition = done;
}

export function navigate(path: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: path }));
}

export function onNavigate(listener: (path: string) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
