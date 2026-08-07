import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { stageStatus } from "../state/generation";
import type { GeneratedOutput } from "../types";
import { OutputDocument } from "./OutputDocument";

const output: GeneratedOutput = {
  id: "out-case",
  type: "investment_case",
  title: "Investment Case Draft",
  status: "Model generated - human review required",
  sections: [
    {
      id: "sec-1",
      type: "narrative",
      heading: "Strategic Opportunity",
      body: "A concise source-grounded draft.",
      citations: [
        {
          sourceId: "src-1",
          label: "Synthetic source",
          locator: "p. 1",
          excerpt: "Synthetic excerpt.",
        },
      ],
    },
  ],
};

describe("result rendering", () => {
  it("renders generated output sections and citation chips", () => {
    const html = renderToStaticMarkup(<OutputDocument output={output} sections={output.sections} />);

    expect(html).toContain("Investment Case Draft");
    expect(html).toContain("Strategic Opportunity");
    expect(html).toContain("Synthetic source");
    expect(html).toContain("Export PDF");
    expect(html).toContain("Export DOCX");
    expect(html).toContain("Export PPTX");
    expect(html).not.toContain("Future phase");
  });

  it("reports generation progress stage status", () => {
    expect(stageStatus(0, 2, false)).toBe("complete");
    expect(stageStatus(2, 2, false)).toBe("active");
    expect(stageStatus(4, 2, false)).toBe("pending");
    expect(stageStatus(2, 2, true)).toBe("failed");
  });
});
