// "Ask Roomset": speak a question while the camera looks at the room. Muse Spark answers aloud and
// suggests catalog pieces, each one tap from AR. Sizes come from the catalog, never the model.

import { Ear, Eye, Loader2, Mic, Quote, RotateCcw, ScanEye, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../../api/client";
import type { AssistantHeard, AssistantReply } from "../../api/contracts";
import { CATALOG, CATALOG_BY_ID } from "../../studio/apartment";
import { ROOM_SETS, arHref, setHref, sizeLabel, type ArSupport } from "./ar";
import { isMuted, replyLanguage, setMuted, speak, stopSpeaking, unlock } from "./voice";

const MAX_SECONDS = 20;
const PHOTO_EDGE = 768; // The server works at this size; sending more only slows the upload.
const AUDIO_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
const BARS = 5;

type Phase = "ready" | "listening" | "thinking" | "answer" | "error";

const CATALOG_FACTS = JSON.stringify({
  pieces: CATALOG.filter((item) => item.model).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    size_cm: item.size.map((metres) => Math.round(metres * 100)),
  })),
  sets: ROOM_SETS.map((set) => ({ id: set.id, name: set.name, pieces: set.pieces, floor_m: [set.size[0], set.size[1]] })),
});

function frame(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth) return Promise.resolve(null);
  const scale = Math.min(1, PHOTO_EDGE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

export function Assistant({ enabled, support, onClose }: { enabled: boolean; support: ArSupport; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const meter = useRef<{ context: AudioContext; frame: number } | null>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  // Set when the sheet closes, so a question cut off mid-sentence is never sent or paid for.
  const closed = useRef(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [camera, setCamera] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [heard, setHeard] = useState<AssistantHeard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(isMuted);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    closed.current = false;
    // Opens the server's provider connections while the person frames the room. Free.
    api.warmAssistant().catch(() => undefined);
    let cancelled = false;
    const open = async () => {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
      } catch {
        // No camera, or it was refused: words alone still work.
        setCamera(false);
        try {
          stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          setError("Roomset needs the microphone to hear you. Allow it in Safari's settings, then try again.");
          setPhase("error");
          return;
        }
      }
      if (cancelled) stream.current?.getTracks().forEach((track) => track.stop());
      else if (video.current && stream.current.getVideoTracks().length) video.current.srcObject = stream.current;
    };
    void open();
    return () => {
      cancelled = true;
      closed.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (meter.current) {
        cancelAnimationFrame(meter.current.frame);
        void meter.current.context.close();
      }
      stopSpeaking();
    };
  }, [enabled]);

  useEffect(() => {
    if (phase !== "listening") return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const stopMeter = () => {
    if (!meter.current) return;
    cancelAnimationFrame(meter.current.frame);
    void meter.current.context.close();
    meter.current = null;
  };

  /** Bars that follow the voice, drawn straight to the DOM so React does not re-render each frame. */
  const startMeter = (tracks: MediaStreamTrack[]) => {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(new MediaStream(tracks)).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const draw = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += (sample - 128) ** 2;
      const level = Math.min(1, Math.sqrt(sum / samples.length) / 40);
      bars.current.forEach((bar, index) => {
        const shape = 1 - Math.abs(index - (BARS - 1) / 2) / BARS;
        if (bar) bar.style.transform = `scaleY(${0.18 + level * shape * 1.6})`;
      });
      meter.current!.frame = requestAnimationFrame(draw);
    };
    meter.current = { context, frame: requestAnimationFrame(draw) };
  };

  const say = useCallback((next: AssistantReply) => {
    const started = speak(next.answer, replyLanguage(next.language, next.answer), () => setSpeaking(false));
    setSpeaking(started);
  }, []);

  const send = useCallback(async (audio: Blob) => {
    setPhase("thinking");
    try {
      // The photo is taken as the question ends, so it shows what the person was looking at.
      const photo = camera && video.current ? await frame(video.current) : null;
      const question = await api.hearQuestion(audio).catch((cause: ApiError) => {
        // A dropped upload on a phone connection never reached transcription, so a retry costs nothing.
        if (cause.status === 0 || cause.status === 400) return api.hearQuestion(audio);
        throw cause;
      });
      setHeard(question);
      if (closed.current) return;
      const next = await api.askAssistant(question, photo, CATALOG_FACTS);
      if (closed.current) return;
      setReply(next);
      setPhase("answer");
      say(next);
    } catch (cause) {
      setError((cause as ApiError).message);
      setPhase("error");
    }
  }, [camera, say]);

  const start = () => {
    const audioTracks = stream.current?.getAudioTracks() ?? [];
    if (!audioTracks.length) return;
    unlock();
    stopSpeaking();
    const mimeType = AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const chunks: Blob[] = [];
    const next = new MediaRecorder(new MediaStream(audioTracks), mimeType ? { mimeType } : undefined);
    next.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    next.onstop = () => {
      stopMeter();
      if (closed.current) return;
      void send(new Blob(chunks, { type: next.mimeType || mimeType || "audio/mp4" }));
    };
    next.start();
    recorder.current = next;
    startMeter(audioTracks);
    setSeconds(0);
    setError(null);
    setReply(null);
    setHeard(null);
    setPhase("listening");
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  useEffect(() => {
    if (phase === "listening" && seconds >= MAX_SECONDS) stop();
  }, [phase, seconds]);

  const toggleVoice = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const nextMuted = !muted && !reply ? true : false;
    if (reply && !speaking) {
      setMuted(false);
      setMutedState(false);
      unlock();
      say(reply);
      return;
    }
    setMuted(nextMuted);
    setMutedState(nextMuted);
  };

  const status = {
    ready: camera ? "Tap to ask" : "Tap to ask · camera off",
    listening: `Listening · ${MAX_SECONDS - seconds}s`,
    thinking: "Thinking",
    answer: "Ask another",
    error: "Try again",
  }[phase];

  return (
    <div className={`as as--${phase}`} role="dialog" aria-modal="true" aria-label="Ask Roomset">
      <div className="as-view">
        {enabled && camera && <video ref={video} autoPlay playsInline muted />}
        {(!enabled || !camera) && <div className="as-nocam"><ScanEye size={44} strokeWidth={1} /></div>}
        <span className="as-frame" aria-hidden="true"><i /><i /><i /><i /></span>
        <header className="as-top">
          <span className="as-brand"><Sparkles size={16} strokeWidth={1.6} />Ask Roomset</span>
          <div className="as-tools">
            {enabled && (
              <button onClick={toggleVoice} aria-label={speaking ? "Stop reading aloud" : muted ? "Read answers aloud" : "Mute the voice"} title={speaking ? "Stop" : muted ? "Voice off" : "Voice on"}>
                {speaking ? <Square size={16} strokeWidth={1.8} fill="currentColor" /> : muted ? <VolumeX size={20} strokeWidth={1.5} /> : <Volume2 size={20} strokeWidth={1.5} />}
              </button>
            )}
            <button onClick={onClose} aria-label="Close"><X size={22} strokeWidth={1.5} /></button>
          </div>
        </header>
      </div>

      <section className="as-panel">
        <div className="as-body" data-lenis-prevent>
        {!enabled ? (
          <div className="as-intro">
            <h2>Ask Roomset</h2>
            <p>The voice assistant is not switched on yet. It needs the speech and Muse Spark keys on the server.</p>
          </div>
        ) : phase === "answer" && reply ? (
          <div className="as-answer" aria-live="polite">
            <p className="as-question"><Quote size={14} strokeWidth={1.6} aria-hidden="true" />{reply.question}</p>
            <p className={speaking ? "as-reply is-speaking" : "as-reply"}>{reply.answer}</p>
            {reply.seen.length > 0 && (
              <ul className="as-seen" aria-label="What Roomset can see">
                <li className="as-seen-icon" aria-hidden="true"><Eye size={14} strokeWidth={1.6} /></li>
                {reply.seen.map((thing) => <li key={thing}>{thing}</li>)}
              </ul>
            )}
            {reply.suggestions.length > 0 && (
              <ul className="as-suggest" aria-label="Suggestions">
                {reply.suggestions.map((suggestion) => {
                  const set = suggestion.kind === "set" ? ROOM_SETS.find((entry) => entry.id === suggestion.id) : undefined;
                  const piece = suggestion.kind === "piece" ? CATALOG_BY_ID.get(suggestion.id) : undefined;
                  if (!set && !piece) return null;
                  const href = set ? setHref(set, support) : arHref(piece!, support);
                  const image = set ? `/studio/ar/sets/${set.id}.webp` : `/studio/thumbs/${piece!.model}.webp`;
                  const name = set ? set.name : piece!.name;
                  return (
                    <li key={`${suggestion.kind}-${suggestion.id}`}>
                      {href ? <a rel="ar" href={href}><img src={image} alt={`Place the ${name.toLowerCase()} in your room`} /></a> : <span className="as-thumb"><img src={image} alt="" /></span>}
                      <div>
                        <b>{name}</b>
                        <span>{set ? `${set.count} pieces` : `${sizeLabel(piece!)} cm`}</span>
                        {suggestion.reason && <small>{suggestion.reason}</small>}
                      </div>
                      {href && <ScanEye className="as-ar" size={20} strokeWidth={1.4} aria-hidden="true" />}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="as-foot">Sizes come from the catalog models. Roomset describes what it sees; it does not measure your room.</p>
          </div>
        ) : phase === "thinking" ? (
          <div className="as-thinking" aria-live="polite">
            {heard && <p className="as-question"><Quote size={14} strokeWidth={1.6} aria-hidden="true" />{heard.question}</p>}
            <ol className="as-steps">
              <li className={heard ? "is-done" : "is-now"}><Ear size={18} strokeWidth={1.5} />{heard ? "Heard you" : "Hearing your question"}</li>
              <li className={heard ? "is-now" : ""}><Eye size={18} strokeWidth={1.5} />Looking at the room</li>
              <li className={heard ? "is-now" : ""}><Sparkles size={18} strokeWidth={1.5} />Choosing pieces that fit</li>
            </ol>
          </div>
        ) : (
          <div className="as-intro">
            <h2>{phase === "error" ? "Let's try that again" : phase === "listening" ? "I'm listening" : "What would suit this room?"}</h2>
            <p>{phase === "error" ? error : phase === "listening" ? "English or Vietnamese. Tap again when you're done." : camera ? "Point at the space and ask out loud, in English or Vietnamese. Roomset answers, reads it to you, and puts pieces one tap from AR." : "Your camera is off, so the answer comes from your words alone."}</p>
          </div>
        )}

        </div>
        {enabled && (
          <div className="as-controls">
            <div className="as-wave" aria-hidden="true">
              {Array.from({ length: BARS }, (_, index) => <span key={index} ref={(element) => { bars.current[index] = element; }} />)}
            </div>
            {phase === "answer" || phase === "error" ? (
              <button className="as-mic" onClick={() => { stopSpeaking(); setSpeaking(false); setReply(null); setPhase("ready"); }} aria-label="Ask again"><RotateCcw size={26} strokeWidth={1.4} /></button>
            ) : phase === "thinking" ? (
              <button className="as-mic" disabled aria-label="Thinking"><Loader2 className="spin" size={28} strokeWidth={1.4} /></button>
            ) : phase === "listening" ? (
              <button className="as-mic is-live" onClick={stop} aria-label="Stop and send"><Square size={22} strokeWidth={1.5} fill="currentColor" /></button>
            ) : (
              <button className="as-mic" onClick={start} aria-label="Start speaking"><Mic size={28} strokeWidth={1.4} /></button>
            )}
            <span className="as-status" aria-live="polite">{status}</span>
          </div>
        )}
      </section>
    </div>
  );
}
