import { describe, expect, it } from "vitest";

import type { Project } from "../types";
import { projectResumeTarget } from "./projectNavigation";

function project(overrides: Partial<Project>): Project {
  return {
    id: "project-1",
    name: "Test project",
    createdAt: "2026-08-07T20:00:00Z",
    updatedAt: "2026-08-07T20:00:00Z",
    demoNotice: "Demo",
    ...overrides,
  };
}

describe("projectResumeTarget", () => {
  it("returns results for a generated project", () => {
    expect(projectResumeTarget(project({ generationId: "generation-1" }))).toMatchObject({
      label: "Review outputs",
      path: "/projects/project-1/results",
      status: "Generated",
    });
  });

  it("returns updates when approved changes affected generated outputs", () => {
    expect(
      projectResumeTarget(
        project({
          generationId: "generation-1",
          memorySummary: {
            updateCount: 1,
            pendingUpdateCount: 0,
            approvedMemoryCount: 3,
            needsRefreshCount: 1,
          },
        }),
      ),
    ).toMatchObject({
      label: "Review updates",
      path: "/projects/project-1/updates",
      status: "Needs refresh",
    });
  });

  it("resumes a new source project at extraction review before setup is ready", () => {
    expect(
      projectResumeTarget(
        project({
          task: {
            selectedTaskId: "donor_meeting",
            taskLabel: "Prepare for a donor meeting",
            customDescription: "",
            metadata: {},
          },
          opportunityAudience: {
            sourceMode: "new",
            opportunityId: null,
            audienceId: "audience-1",
            intendedOutcome: "Explore",
            suggestions: [],
            selectedOutputs: ["investment_case"],
          },
          extractionId: "extraction-1",
          reviewSetup: {
            approachFields: [],
            roles: [],
            confirmed: false,
            sourceReadiness: {
              ready: false,
              checks: [],
              blockingIssues: ["Confirm extracted source facts."],
            },
          },
        }),
      ),
    ).toMatchObject({
      label: "Review source",
      path: "/projects/project-1/extraction-review",
    });
  });
});
