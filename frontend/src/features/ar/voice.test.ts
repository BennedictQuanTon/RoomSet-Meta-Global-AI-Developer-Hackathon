import { describe, expect, it } from "vitest";
import { pickVoice, replyLanguage } from "./voice";

const voice = (name: string, lang: string, localService = true) => ({ name, lang, localService }) as SpeechSynthesisVoice;

describe("replyLanguage", () => {
  it("trusts the detected language", () => expect(replyLanguage("vi", "Hello")).toBe("vi"));
  it("spots Vietnamese letters when no language came back", () => expect(replyLanguage(null, "Góc phòng này sáng")).toBe("vi"));
  it("falls back to English", () => expect(replyLanguage("en", "A bright corner")).toBe("en"));
  it("catches plain accented words", () => expect(replyLanguage(null, "Bạn nên đặt sofa ở đây")).toBe("vi"));
  it("trusts English detection over a stray accent", () => expect(replyLanguage("en", "A café-style corner")).toBe("en"));
});

describe("pickVoice", () => {
  const voices = [voice("Fred", "en-US"), voice("Samantha (Enhanced)", "en-US"), voice("Linh", "vi-VN"), voice("Google Tiếng Việt", "vi-VN", false)];
  it("prefers enhanced voices", () => expect(pickVoice("en", voices)?.name).toBe("Samantha (Enhanced)"));
  it("picks a Vietnamese voice for Vietnamese", () => expect(pickVoice("vi", voices)?.name).toBe("Linh"));
  it("returns null when the device has none", () => expect(pickVoice("vi", [voice("Fred", "en-US")])).toBeNull());
});
