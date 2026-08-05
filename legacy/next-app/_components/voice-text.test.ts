import { describe, expect, it } from "vitest";

import {
  clampTextToMaxLength,
  mergeDictationText,
  normalizeDictationText,
} from "./voice-text";

describe("voice text helpers", () => {
  it("normalizes browser transcript spacing", () => {
    expect(normalizeDictationText("  funder   asked\nabout scale  ")).toBe(
      "funder asked about scale",
    );
  });

  it("appends spoken text with natural spacing", () => {
    expect(mergeDictationText("Existing note", "new point", "")).toBe(
      "Existing note new point",
    );
  });

  it("inserts spoken text before punctuation without adding extra spaces", () => {
    expect(mergeDictationText("Ask", "about evidence", ".")).toBe(
      "Ask about evidence.",
    );
  });

  it("respects field max length when dictation is merged", () => {
    expect(clampTextToMaxLength("abcdef", 4)).toBe("abcd");
  });
});
