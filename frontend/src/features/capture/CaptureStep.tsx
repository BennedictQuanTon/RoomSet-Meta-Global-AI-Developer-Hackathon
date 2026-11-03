// Guided photo or video capture, with per-photo feedback and replacement.

import { ArrowLeft, ArrowRight, Camera, Images, MoveLeft, MoveRight, ScanLine, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, api, type Auth } from "../../api/client";
import type { Capabilities, PhotoFlag, PhotoView, SessionView } from "../../api/contracts";
import { StepLayout } from "../planner/StepLayout";
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
      <button className="thumb-remove" onClick={onRemove} aria-label="Remove this photo"><X size={18} strokeWidth={1.6} /></button>
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

  const off = remaining <= 0 ? " is-disabled" : "";

  return (
    <StepLayout image="/landing/hero-reading.webp" title="Show us the corner" lead="Overlapping photos help the most.">
      <ol className="plan-guide">
        <li><ScanLine size={26} strokeWidth={1.3} />Stand back so the whole empty spot is visible.</li>
        <li><MoveLeft size={26} strokeWidth={1.3} />Take a few steps left, keeping the corner in view.</li>
        <li><MoveRight size={26} strokeWidth={1.3} />Now a few steps right. Overlap is what helps.</li>
      </ol>

      <div className="plan-tiles">
        <label className={`plan-tile${off}`}>
          <Camera size={30} strokeWidth={1.3} />Take photo
          <input type="file" accept="image/*" capture="environment" hidden disabled={remaining <= 0 || !!busy} onChange={(e) => addFiles(e.target.files)} />
        </label>
        <label className={`plan-tile${off}`}>
          <Images size={30} strokeWidth={1.3} />Upload photos
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={remaining <= 0 || !!busy} onChange={(e) => addFiles(e.target.files)} />
        </label>
        <label className={`plan-tile${off}`}>
          <Video size={30} strokeWidth={1.3} />Use a short video
          <input type="file" accept="video/*" capture="environment" hidden disabled={remaining <= 0 || !!busy} onChange={(e) => addVideo(e.target.files?.[0])} />
        </label>
      </div>

      {busy && <p className="plan-note" role="status">{busy}</p>}
      {error && <p className="error-note" role="alert">{error}</p>}

      <ul className="thumbs">
        {photos.map((photo) => (
          <Thumb key={photo.id} auth={auth} photo={photo}
            onRemove={() => void run("Removing…", () => api.deletePhoto(auth, photo.id))} />
        ))}
      </ul>

      <div className="plan-count">
        <span className="plan-dots" aria-hidden="true">
          {Array.from({ length: capabilities.max_photos }, (_, index) => <span key={index} className={index < photos.length ? "is-on" : ""} />)}
        </span>
        <p className="plan-note">{photos.length} of {capabilities.max_photos} photos. At least {capabilities.min_photos} needed.</p>
      </div>

      <div className="plan-actions">
        <button className="plan-round" onClick={onBack} aria-label="Back" title="Back"><ArrowLeft size={22} strokeWidth={1.5} /></button>
        <button className="rs-button" disabled={photos.length < capabilities.min_photos || !!busy} onClick={proceed}>Continue<ArrowRight size={20} strokeWidth={1.5} /></button>
      </div>
    </StepLayout>
  );
}
