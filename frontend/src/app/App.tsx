// Chooses the screen from server state, so a reload always lands in the right place.

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, type Auth } from "../api/client";
import type { Capabilities, SessionView } from "../api/contracts";
import { CaptureStep } from "../features/capture/CaptureStep";
import { ClarifyStep } from "../features/clarify/ClarifyStep";
import { ProductStep } from "../features/product/ProductStep";
import { ProgressStep } from "../features/progress/ProgressStep";
import { ResultStep } from "../features/result/ResultStep";
import { navigate } from "./nav";
import { loadAuth, saveAuth } from "./sessionStore";

type Override = "product" | "capture" | null;

export function App() {
  const [auth, setAuth] = useState<Auth | null>(loadAuth);
  const [session, setSession] = useState<SessionView | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [override, setOverride] = useState<Override>(null);
  const [restoring, setRestoring] = useState(Boolean(auth));
  const [error, setError] = useState<string | null>(null);
  const [serverMissing, setServerMissing] = useState(false);

  useEffect(() => {
    api.capabilities().then(setCapabilities).catch(() => setServerMissing(true));
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

  const begin = useCallback(async () => {
    setError(null);
    try {
      const created = await api.createSession();
      const next = { id: created.session.id, token: created.token };
      saveAuth(next);
      setAuth(next);
      setSession(created.session);
    } catch (cause) {
      setError((cause as ApiError).message);
    }
  }, []);

  // Arriving here means starting a plan; the choice was made on the /start page.
  const starting = useRef(false);
  useEffect(() => {
    if (auth || !capabilities || starting.current) return;
    starting.current = true;
    void begin();
  }, [auth, capabilities, begin]);

  const startOver = useCallback(async () => {
    if (auth) await api.deleteSession(auth).catch(() => undefined);
    saveAuth(null);
    navigate("/start");
  }, [auth]);

  const update = useCallback((next: SessionView) => {
    setSession(next);
    setOverride(null);
  }, []);

  const content = () => {
    if (serverMissing) {
      return (
        <section className="step app-offline">
          <h2>Planning your own room needs the Roomset server.</h2>
          <p className="rs-note">This preview runs without it. The 3D sample apartment works fully here.</p>
          <button className="rs-button" onClick={() => navigate("/studio")}>Enter the sample apartment</button>
        </section>
      );
    }
    if (!auth && error) return <button className="rs-button" onClick={() => void begin()}>Try again</button>;
    if (restoring || !capabilities || !auth || !session) return <p className="rs-note">Loading…</p>;
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
        <a className="app-logo" href="/start" onClick={(event) => { event.preventDefault(); navigate("/start"); }} aria-label="Back to all options">
          <img src="/brand/logo-dark.png" alt="roomset" height={32} />
        </a>
        <nav className="app-links" aria-label="Pages">
          <a href="/start" onClick={(event) => { event.preventDefault(); navigate("/start"); }}>All options</a>
          <a href="/studio" onClick={(event) => { event.preventDefault(); navigate("/studio"); }}>Sample apartment</a>
          {auth && <button onClick={startOver}>Start over</button>}
        </nav>
      </header>
      <main className="app-main">
        {error && <p className="error-note" role="alert">{error}</p>}
        {content()}
      </main>
    </div>
  );
}
