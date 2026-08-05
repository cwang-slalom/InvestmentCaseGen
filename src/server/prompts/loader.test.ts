import { describe, expect, it } from "vitest";

import { loadPrompt } from "./loader";

describe("loadPrompt", () => {
  it("loads prompt text and a stable content version", async () => {
    const prompt = await loadPrompt("extract-opportunities");

    expect(prompt.name).toBe("extract-opportunities");
    expect(prompt.text).toContain("Extract Opportunities");
    expect(prompt.version).toHaveLength(12);
  });
});
