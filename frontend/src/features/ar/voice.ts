// Reads answers aloud with the best voice the device has. Free and on-device: on iPhone this is
// a Siri voice, Linh for Vietnamese. Safari only speaks after a tap, so unlock() runs on the mic tap.

const MUTE_KEY = "roomset.voice.muted";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // A private window can refuse storage; the choice then lasts for this visit.
  }
  if (muted) stopSpeaking();
}

const speechAvailable = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function unlock(): void {
  if (!speechAvailable()) return;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
}

// Every Vietnamese letter that English does not use, so a single word is enough to tell.
const VIETNAMESE_LETTERS = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;

/** The language heard in the question; without one, Vietnamese letters decide. */
export function replyLanguage(language: string | null, text: string): "vi" | "en" {
  // The reply follows the question, so the language heard in the question decides when known.
  if (language) return language.toLowerCase().startsWith("vi") ? "vi" : "en";
  return VIETNAMESE_LETTERS.test(text) ? "vi" : "en";
}

function rank(voice: SpeechSynthesisVoice): number {
  if (/premium|enhanced|neural|natural/i.test(voice.name)) return 0;
  if (/siri/i.test(voice.name)) return 1;
  if (/samantha|ava|zoe|linh/i.test(voice.name)) return 2;
  return voice.localService ? 3 : 4;
}

export function pickVoice(language: "vi" | "en", voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const pool = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(language));
  return pool.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export function speak(text: string, language: "vi" | "en", onEnd: () => void): boolean {
  if (!speechAvailable() || isMuted()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(language, synth.getVoices());
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? (language === "vi" ? "vi-VN" : "en-US");
  utterance.rate = language === "vi" ? 1 : 0.98;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  synth.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
