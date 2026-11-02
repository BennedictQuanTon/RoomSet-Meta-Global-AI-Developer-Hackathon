// Guided photo or video capture, with per-photo feedback and replacement.

import { useEffect, useState } from "react";
import { ApiError, api, type Auth } from "../../api/client";
import type { Capabilities, PhotoFlag, PhotoView, SessionView } from "../../api/contracts";
import { extractFrames } from "./videoFrames";

const FLAG_COPY: Record<PhotoFlag, string> = {
  blurry: "Looks blurry. Take another photo with the same corner in view.",
  too_dark: "Too dark. Turn on a light and take another photo.",
  duplicate: "Same as another photo. Take a few steps sideways.",
};

function Thumb({ auth, photo, onRemove }: { auth: Auth; photo: PhotoView; onRemove: () => void }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let url: string | undefined;
    let alive = true;
    api.blobUrl(auth, `photos/${photo.id}`).then((next) => {
      url = next;
      if (alive) setSrc(next);
      else URL.revokeObjectURL(next);
    }).catch(() => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [auth, photo.id]);

  return (
    <li className={photo.quality.flags.length ? "thumb thumb--flagged" : "thumb"}>
      {src ? <img src={src} alt="" /> : <div className="thumb-placeholder" />}
      <button className="thumb-remove" onClick={onRemove} aria-label="Remove this photo">×</button>
      {photo.quality.flags.map((flag) => <p key={flag} className="thumb-flag">{FLAG_COPY[flag]}</p>)}
    </li>
  );
}

interface Props {
  auth: Auth;
  session: SessionView;
  capabilities: Capabilities;
  onSession: (session: SessionView) => void;
  onDone: (session: SessionView) => void;
  onBack: () => void;
}

export function CaptureStep({ auth, session, capabilities, onSession, onDone, onBack }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { photos } = session;
  const remaining = capabilities.max_photos - photos.length;

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
      onSession(await api.getSession(auth).catch(() => session));
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    void run("Checking photos…", async () => {
      for (const file of Array.from(files).slice(0, remaining)) {
        await api.uploadPhoto(auth, file, file.name);
      }
    });
  };

  const addVideo = (file?: File) => {
    if (!file) return;
    void run("Reading your video…", async () => {
      const frames = await extractFrames(file, remaining);
      for (const frame of frames) await api.uploadPhoto(auth, frame);
    });
  };

  const proceed = () =>
    run("Reviewing your photos…", async () => {
      onDone(await api.check(auth).catch((cause: ApiError) => { throw cause; }));
    });

  return (
    <section className="step">
      <p className="step-count">Step 2 of 4</p>
      <h2>Show us the corner</h2>
      <ol className="guide">
        <li>Stand back so the whole empty spot is visible.</li>
        <li>Take a few steps left, keeping the corner in view.</li>
        <li>Now a few steps right. Overlap is what helps.</li>
      </ol>

      <div className="capture-actions">
        <label className={`rs-button${remaining <= 0 ? " is-disabled" : ""}`}>
          Take photo
          <input type="file" accept="image/*" capture="environment" hidden disabled={remaining <= 0 || !!busy} onChange={(e) => addFiles(e.target.files)} />
        </label>
        <label className={`rs-button rs-button--secondary${remaining <= 0 ? " is-disabled" : ""}`}>
          Upload photos
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={remaining <= 0 || !!busy} onChange={(e) => addFiles(e.target.files)} />
        </label>
        <label className={`rs-button rs-button--secondary${remaining <= 0 ? " is-disabled" : ""}`}>
          Use a short video
          <input type="file" accept="video/*" capture="environment" hidden disabled={remaining <= 0 || !!busy} onChange={(e) => addVideo(e.target.files?.[0])} />
        </label>
      </div>

      {busy && <p className="rs-note" role="status">{busy}</p>}
      {error && <p className="error-note" role="alert">{error}</p>}

      <ul className="thumbs">
        {photos.map((photo) => (
          <Thumb key={photo.id} auth={auth} photo={photo}
            onRemove={() => void run("Removing…", () => api.deletePhoto(auth, photo.id))} />
        ))}
      </ul>
      <p className="rs-note">{photos.length} of {capabilities.max_photos} photos. At least {capabilities.min_photos} needed.</p>

      <div className="actions">
        <button className="rs-button rs-button--secondary" onClick={onBack}>Back</button>
        <button className="rs-button" disabled={photos.length < capabilities.min_photos || !!busy} onClick={proceed}>Continue</button>
      </div>
    </section>
  );
}
