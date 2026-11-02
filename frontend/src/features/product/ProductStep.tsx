// Link, screenshot or manual entry. Nothing is used until the person confirms it.

import { Armchair, ArrowRight, ImageUp, Link2, Loader2, MoveDiagonal, MoveHorizontal, MoveVertical, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError, api, type Auth } from "../../api/client";
import type { Capabilities, MeasuredField, ProductDraft, SessionView } from "../../api/contracts";
import { StepLayout } from "../planner/StepLayout";

const SOURCE_LABEL: Record<MeasuredField["source"], string> = {
  listing_data: "From the listing",
  listing_ai: "Read from the listing by AI. Please check it.",
  screenshot_ai: "Read from your screenshot by AI. Please check it.",
  user: "Confirmed by you",
  missing: "Add the value from the listing.",
};

type Dimension = "width" | "depth" | "height";
const DIMENSIONS: { id: Dimension; Icon: LucideIcon }[] = [
  { id: "width", Icon: MoveHorizontal },
  { id: "depth", Icon: MoveDiagonal },
  { id: "height", Icon: MoveVertical },
];

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
    <StepLayout image="/landing/hero-lounge.webp" title="Which sofa?" lead="Paste its link, or type the size from the listing.">
      <form className="plan-group" onSubmit={readLink}>
        <div className="plan-field">
          <label className="plan-label" htmlFor="listing"><Link2 size={20} strokeWidth={1.5} />Sofa listing link</label>
          <div className="plan-inline">
            <input id="listing" className="rs-input" type="url" required placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="plan-round plan-round--solid" disabled={busy} aria-label={busy ? "Reading" : "Read this listing"} title="Read this listing">
              {busy ? <Loader2 className="spin" size={22} /> : <ArrowRight size={22} strokeWidth={1.5} />}
            </button>
            {capabilities.product_ai && (
              <label className="plan-round" aria-label="Upload a screenshot" title="Upload a screenshot">
                <ImageUp size={22} strokeWidth={1.5} />
                <input type="file" accept="image/*" hidden disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void run(async () => applyDraft(await api.readScreenshot(auth, file)));
                  }} />
              </label>
            )}
          </div>
        </div>
        {!capabilities.product_ai && <p className="plan-note">Some shops block reading. You can always enter the size below.</p>}
      </form>

      {error && <p className="error-note" role="alert">{error}</p>}

      <form className="plan-group" onSubmit={confirm}>
        <h3>Confirm the size</h3>
        <div className="plan-field">
          <label className="plan-label" htmlFor="name"><Armchair size={20} strokeWidth={1.5} />Name</label>
          <input id="name" className="rs-input" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="plan-sizes">
          {DIMENSIONS.map(({ id, Icon }) => (
            <div key={id} className="plan-field">
              <label className="plan-label" htmlFor={id}><Icon size={20} strokeWidth={1.5} />{id[0].toUpperCase() + id.slice(1)} (cm)</label>
              <input id={id} className="rs-input" type="number" inputMode="decimal" step="0.1" required min={id === "height" ? 21 : 31} max={id === "width" ? 599 : id === "depth" ? 399 : 249}
                value={sizes[id]} onChange={(e) => setSizes({ ...sizes, [id]: e.target.value })} />
              {draft && <p className="field-source">{SOURCE_LABEL[draft[id].source]}</p>}
            </div>
          ))}
        </div>
        <div className="plan-actions">
          <button className="rs-button" disabled={busy}>Confirm dimensions<ArrowRight size={20} strokeWidth={1.5} /></button>
        </div>
      </form>
    </StepLayout>
  );
}
