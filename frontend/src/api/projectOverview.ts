import type {
  ArtifactVersion,
  GenerationResult,
  OutputChangeDecision,
  OutputChangeProposal,
  OutputChangeReview,
  OutputType,
  Project,
  ProjectUpdate,
} from "../types";

type ChangeReviewRequest = {
  project: Project;
  outputType: OutputType;
  outputTitle: string;
  currentVersion: number;
  updates: ProjectUpdate[];
  generation: GenerationResult | null;
};

type ApplyChangesRequest = {
  projectId: string;
  outputType: OutputType;
  outputTitle: string;
  currentVersion: number;
  acceptedChanges: Array<OutputChangeProposal & { decision: OutputChangeDecision }>;
};

export const projectOverviewApi = {
  async getOutputChangeReview(request: ChangeReviewRequest): Promise<OutputChangeReview> {
    return mockOutputChangeReview(request);
  },

  async applyAcceptedOutputChanges(request: ApplyChangesRequest): Promise<ArtifactVersion> {
    return {
      id: `artifact-${request.projectId}-${request.outputType}-v${request.currentVersion + 1}-${Date.now()}`,
      projectId: request.projectId,
      outputId: `${request.outputType}-accepted-changes`,
      outputType: request.outputType,
      title: request.outputTitle,
      version: request.currentVersion + 1,
      status: "current",
      generationId: `local-review-${request.projectId}`,
      createdFromUpdateId: null,
      createdAt: new Date().toISOString(),
    };
  },
};

function mockOutputChangeReview({
  outputType,
  outputTitle,
  currentVersion,
  updates,
  generation,
}: ChangeReviewRequest): OutputChangeReview {
  const relevantUpdates = updates.filter((update) =>
    update.affectedOutputs.some((affected) => affected.outputType === outputType),
  );
  const sourceUpdate = relevantUpdates[0] || updates[0];
  const currentOutput = generation?.outputs.find((output) => output.type === outputType);
  const candidates = relevantUpdates.flatMap((update) => [
    ...update.extractedFacts.map((candidate) => ({ update, value: candidate.value, category: candidate.category })),
    ...update.openQuestions.map((candidate) => ({ update, value: candidate.value, category: candidate.category })),
  ]);
  const templates = changeTemplates(outputType, currentOutput?.sections.map((section) => section.heading) || []);

  const changes = templates.slice(0, Math.max(1, relevantUpdates.length || 1)).map((template, index) => {
    const candidate = candidates[index] || candidates[0];
    const update = candidate?.update || sourceUpdate;
    return {
      id: `${outputType}-change-${index + 1}`,
      outputType,
      sectionName: template.sectionName,
      currentText: template.currentText,
      suggestedText: candidate ? template.suggestedText(candidate.value) : template.fallbackSuggestedText,
      sourceLabel: update?.sourceLabel || "Project update",
      sourceDate: update ? formatShortDate(update.createdAt) : "Unresolved",
    };
  });

  return {
    outputType,
    outputTitle,
    currentVersion,
    nextVersion: currentVersion + 1,
    changes,
  };
}

function changeTemplates(outputType: OutputType, existingSections: string[]) {
  const section = (fallback: string, index = 0) => existingSections[index] || fallback;
  if (outputType === "investment_case") {
    return [
      {
        sectionName: section("Funding timeline", 0),
        currentText: "Funding is expected to begin in Q1 2027.",
        suggestedText: (value: string) => `Reflect the latest update: ${value}`,
        fallbackSuggestedText: "Funding is expected to begin in Q2 2027.",
      },
      {
        sectionName: section("Investment rationale", 1),
        currentText: "The memo frames the opportunity around platform readiness and partner interest.",
        suggestedText: (value: string) => `Add the new evidence point to the rationale: ${value}`,
        fallbackSuggestedText: "The memo should include the updated partner-feedback signal before refreshing the version.",
      },
      {
        sectionName: section("Diligence questions", 2),
        currentText: "Open diligence items include funding recipient, investment vehicle, and partner commitments.",
        suggestedText: (value: string) => `Update the diligence section with this unresolved item: ${value}`,
        fallbackSuggestedText: "Add the unresolved budget and implementation questions to the diligence section.",
      },
    ];
  }
  if (outputType === "one_page") {
    return [
      {
        sectionName: section("Executive summary", 0),
        currentText: "The summary emphasizes vaccine R&D readiness and the opportunity for co-funding.",
        suggestedText: (value: string) => `Condense the new information into the summary: ${value}`,
        fallbackSuggestedText: "The summary should note the latest stakeholder update before circulation.",
      },
      {
        sectionName: section("Why now", 1),
        currentText: "The brief states that partner readiness creates a near-term window.",
        suggestedText: (value: string) => `Refresh the why-now point with: ${value}`,
        fallbackSuggestedText: "The why-now section should reflect the newly analyzed project update.",
      },
    ];
  }
  if (outputType === "talking_points") {
    return [
      {
        sectionName: section("Donor conversation", 0),
        currentText: "The talking points invite HKJC to explore a co-funding partnership.",
        suggestedText: (value: string) => `Add a discussion prompt based on: ${value}`,
        fallbackSuggestedText: "Add a prompt asking HKJC to respond to the updated budget and decision timeline.",
      },
    ];
  }
  return [
    {
      sectionName: section("Source appendix", 0),
      currentText: "The appendix lists the original strategy documents and citations.",
      suggestedText: (value: string) => `Add a citation entry for the new update: ${value}`,
      fallbackSuggestedText: "Add the new update source to the appendix evidence list.",
    },
  ];
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}
