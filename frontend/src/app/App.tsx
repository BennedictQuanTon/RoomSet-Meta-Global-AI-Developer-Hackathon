// Chooses the screen from server state, so a reload always lands in the right place.

import { useCallback, useEffect, useState } from "react";
import { ApiError, api, type Auth } from "../api/client";
import type { Capabilities, SessionView } from "../api/contracts";
import { CaptureStep } from "../features/capture/CaptureStep";
import { ClarifyStep } from "../features/clarify/ClarifyStep";
import { Landing } from "../features/landing/Landing";
import { ProductStep } from "../features/product/ProductStep";
import { ProgressStep } from "../features/progress/ProgressStep";
import { ResultStep } from "../features/result/ResultStep";
import { loadAuth, saveAuth } from "./sessionStore";

type Override = "product" | "capture" | null;

export function App() {
  const [auth, setAuth] = useState<Auth | null>(loadAuth);
  const [session, setSession] = useState<SessionView | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [override, setOverride] = useState<Override>(null);
  const [restoring, setRestoring] = useState(Boolean(auth));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.capabilities().then(setCapabilities).catch(() => setError("We can't reach Roomset right now."));
  }, []);

  useEffect(() => {
    if (!auth || session) return;
    api.getSession(auth)
      .then(setSession)
      .catch((cause: ApiError) => {
        if (cause.status === 404) {
          saveAuth(null);
          setAuth(null);
        } else setError(cause.message);
      })
      .finally(() => setRestoring(false));
  }, [auth, session]);

  const begin = useCallback(async (create: typeof api.createSession) => {
    setError(null);
    try {
      const created = await create();
      const next = { id: created.session.id, token: created.token };
      saveAuth(next);
      setAuth(next);
      setSession(created.session);
    } catch (cause) {
      setError((cause as ApiError).message);
    }
  }, []);

  const startOver = useCallback(async () => {
    if (auth) await api.deleteSession(auth).catch(() => undefined);
    saveAuth(null);
    setAuth(null);
    setSession(null);
    setOverride(null);
  }, [auth]);

  const update = useCallback((next: SessionView) => {
    setSession(next);
    setOverride(null);
  }, []);

  const content = () => {
    if (restoring || !capabilities) return <p className="rs-note">Loading…</p>;
    if (!auth || !session) return <Landing onStart={() => begin(api.createSession)} onSample={() => begin(api.createSample)} />;
    if (override === "product" || !session.product?.confirmed) {
      return <ProductStep auth={auth} session={session} capabilities={capabilities} onDone={update} />;
    }
    switch (session.status) {
      case "ready":
        return <ResultStep auth={auth} session={session} capabilities={capabilities} onSession={setSession} onStartOver={startOver} />;
      case "reconstructing":
      case "building":
      case "failed":
        return <ProgressStep auth={auth} session={session} onSession={setSession} onDone={update} />;
      case "needs_input":
        if (override !== "capture") {
          return <ClarifyStep auth={auth} session={session} onDone={update} onBack={() => setOverride("capture")} />;
        }
    }
    return (
      <CaptureStep
        auth={auth}
        session={session}
        capabilities={capabilities}
        onSession={setSession}
        onDone={update}
        onBack={() => setOverride("product")}
      />
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <button className="logo-button" onClick={startOver} aria-label="Roomset, start over" disabled={!auth}>
          <img src="/roomset-logo.png" alt="roomset" height={44} />
        </button>
      </header>
      <main className="app-main">
        {error && <p className="error-note" role="alert">{error}</p>}
        {content()}
      </main>
    </div>
  );
}
