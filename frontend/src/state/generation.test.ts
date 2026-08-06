import { describe, expect, it } from "vitest";

import {
  activeStageIndexForProgress,
  estimatedGenerationPercent,
  estimatedOutputPercent,
  estimatedRemainingLabel,
  formatGenerationDuration,
} from "./generation";

describe("generation progress estimates", () => {
  it("starts low and never claims completion while a model request is pending", () => {
    expect(estimatedGenerationPercent(0)).toBe(6);
    expect(estimatedGenerationPercent(60)).toBeGreaterThan(estimatedGenerationPercent(10));
    expect(estimatedGenerationPercent(20 * 60)).toBe(92);
  });

  it("maps estimated progress to the current generation stage", () => {
    expect(activeStageIndexForProgress(6)).toBe(0);
    expect(activeStageIndexForProgress(33)).toBe(2);
    expect(activeStageIndexForProgress(90)).toBe(5);
  });

  it("staggers output card progress behind the overall package estimate", () => {
    expect(estimatedOutputPercent(40, 0)).toBe(40);
    expect(estimatedOutputPercent(40, 2)).toBe(24);
    expect(estimatedOutputPercent(4, 1)).toBe(0);
  });

  it("formats elapsed and remaining time for the progress meter", () => {
    expect(formatGenerationDuration(75)).toBe("1m 15s");
    expect(estimatedRemainingLabel(0)).toBe("About 4 min left");
    expect(estimatedRemainingLabel(211)).toBe("Finalizing");
  });
});
