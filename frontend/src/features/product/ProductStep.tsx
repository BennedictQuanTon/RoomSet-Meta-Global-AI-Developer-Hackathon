// Link, screenshot or manual entry. Nothing is used until the person confirms it.

import { useState, type FormEvent } from "react";
import { ApiError, api, type Auth } from "../../api/client";
import type { Capabilities, MeasuredField, ProductDraft, SessionView } from "../../api/contracts";

const SOURCE_LABEL: Record<MeasuredField["source"], string> = {
  listing_data: "From the listing",
  listing_ai: "Read from the listing by AI. Please check it.",
  screenshot_ai: "Read from your screenshot by AI. Please check it.",
  user: "Confirmed by you",
  missing: "Add the value from the listing.",
};

type Dimension = "width" | "depth" | "height";
const DIMENSIONS: Dimension[] = ["width", "depth", "height"];

const toCm = (field?: MeasuredField | null) => (field?.value_m ? String(Math.round(field.value_m * 1000) / 10) : "");

interface Props {
  auth: Auth;
  session: SessionView;
  capabilities: Capabilities;
  onDone: (session: SessionView) => void;
}

export function ProductStep({ auth, session, capabilities, onDone }: Props) {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(session.product);
  const [name, setName] = useState(session.product?.name ?? "");
  const [sizes, setSizes] = useState<Record<Dimension, string>>({
    width: toCm(session.product?.width),
    depth: toCm(session.product?.depth),
    height: toCm(session.product?.height),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyDraft = (next: ProductDraft) => {
    setDraft(next);
    setName(next.name ?? "");
    setSizes({ width: toCm(next.width), depth: toCm(next.depth), height: toCm(next.height) });
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError((cause as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const readLink = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => applyDraft(await api.fetchListing(auth, url)));
  };

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      onDone(await api.confirmProduct(auth, {
        source_url: draft?.source_url ?? (url || null),
        name,
        width_m: Number(sizes.width) / 100,
        depth_m: Number(sizes.depth) / 100,
        height_m: Number(sizes.height) / 100,
        image_urls: draft?.image_urls ?? [],
        appearance: draft?.appearance ?? null,
      }));
    });
  };

  return (
    <section className="step">
      <p className="step-count">Step 1 of 4</p>
      <h2>Which sofa?</h2>

      <form className="rs-card stack" onSubmit={readLink}>
        <label className="rs-label" htmlFor="listing">Sofa listing link</label>
        <input id="listing" className="rs-input" type="url" required placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="rs-button rs-button--secondary" disabled={busy}>{busy ? "Reading…" : "Read this listing"}</button>
        {capabilities.product_ai ? (
          <label className="file-button">
            Or upload a screenshot
            <input type="file" accept="image/*" hidden disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void run(async () => applyDraft(await api.readScreenshot(auth, file)));
              }} />
          </label>
        ) : (
          <p className="rs-note">Some shops block reading. You can always enter the size below.</p>
        )}
      </form>

      {error && <p className="error-note" role="alert">{error}</p>}

      <form className="rs-card stack" onSubmit={confirm}>
        <h3>Confirm the size</h3>
        <label className="rs-label" htmlFor="name">Name</label>
        <input id="name" className="rs-input" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="dimension-grid">
          {DIMENSIONS.map((dimension) => (
            <div key={dimension}>
              <label className="rs-label" htmlFor={dimension}>{dimension[0].toUpperCase() + dimension.slice(1)} (cm)</label>
              <input id={dimension} className="rs-input" type="number" inputMode="decimal" step="0.1" required min={dimension === "height" ? 21 : 31} max={dimension === "width" ? 599 : dimension === "depth" ? 399 : 249}
                value={sizes[dimension]} onChange={(e) => setSizes({ ...sizes, [dimension]: e.target.value })} />
              {draft && <p className="field-source">{SOURCE_LABEL[draft[dimension].source]}</p>}
            </div>
          ))}
        </div>
        <button className="rs-button" disabled={busy}>Confirm dimensions</button>
      </form>
    </section>
  );
}
