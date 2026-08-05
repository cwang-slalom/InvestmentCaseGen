import { randomUUID } from "node:crypto";

import {
  ProductQualityEvaluationSchema,
  type EvidenceBackedText,
  type ProductQualityEvaluation,
  type ProductQualityMetric,
  type ProductQualityMetricKey,
  type ValidatedDraft,
} from "@/domain";

function rationale(
  value: string,
  citationIds: string[] = [],
): EvidenceBackedText {
  return {
    value,
    status:
      citationIds.length > 0 ? "derived_from_sources" : "generated_framing",
    confidence: "medium",
    citationIds,
  };
}

function metric(
  metricKey: ProductQualityMetricKey,
  score: number,
  text: string,
  citationIds: string[] = [],
): ProductQualityMetric {
  return {
    metricKey,
    score: Math.max(1, Math.min(5, Math.round(score))),
    rationale: rationale(text, citationIds),
    citationIds,
  };
}

function citationCoverageScore(draft: ValidatedDraft) {
  const claimsRequiringCitations = draft.claims.filter(
    (claim) =>
      claim.status !== "unresolved" &&
      claim.kind !== "narrative_framing" &&
      (claim.kind === "factual" ||
        claim.kind === "numerical" ||
        claim.kind === "derived"),
  );

  if (claimsRequiringCitations.length === 0) {
    return 5;
  }

  const cited = claimsRequiringCitations.filter(
    (claim) => claim.citationIds.length > 0,
  ).length;

  return 1 + (cited / claimsRequiringCitations.length) * 4;
}

export function evaluateDraftQuality(
  draft: ValidatedDraft,
): ProductQualityEvaluation {
  const validationStatus = draft.validation?.status ?? "failed";
  const validationErrors =
    draft.validation?.findings.filter((finding) => finding.severity === "error")
      .length ?? 1;
  const sectionCompletion =
    draft.sections.length === 0
      ? 1
      : 1 +
        (draft.sections.filter((section) => section.renderedMarkdown.trim())
          .length /
          draft.sections.length) *
          4;
  const unresolvedVisible = draft.evidenceGaps.length > 0 ? 5 : 3;
  const citationScore = citationCoverageScore(draft);
  const noRoleConfusion = draft.claims.every(
    (claim) =>
      !/GPD|Gates Foundation/i.test(claim.statement) ||
      !/funding recipient|investment vehicle/i.test(claim.statement),
  );
  const validationScore =
    validationStatus === "passed"
      ? 5
      : validationStatus === "passed_with_warnings"
        ? 4
        : Math.max(1, 3 - validationErrors);

  const metrics = [
    metric(
      "factual_support",
      validationScore,
      `${validationStatus.replaceAll("_", " ")} citation validation result.`,
    ),
    metric(
      "citation_coverage",
      citationScore,
      "Share of factual, numerical, and derived claims with citations.",
    ),
    metric(
      "role_distinction",
      noRoleConfusion ? 5 : 2,
      noRoleConfusion
        ? "Draft does not conflate named sponsors with the funding recipient or vehicle."
        : "Draft may conflate sponsor or author names with funding recipient language.",
    ),
    metric(
      "unresolved_gap_visibility",
      unresolvedVisible,
      draft.evidenceGaps.length > 0
        ? "Evidence gaps are visible in the draft."
        : "No evidence gaps are visible; confirm this is intentional.",
    ),
    metric(
      "completeness",
      sectionCompletion,
      "Required sections are present and non-empty.",
    ),
    metric(
      "source_faithfulness",
      validationScore,
      "Source faithfulness is proxied by citation validation status.",
    ),
    metric(
      "donor_persuasiveness",
      draft.narrativeChanges.length > 0 ? 4 : 3,
      draft.narrativeChanges.length > 0
        ? "Narrative strengthening and segment tailoring were applied."
        : "Draft is source-grounded but not strongly tailored.",
    ),
    metric(
      "edit_readiness",
      validationErrors === 0 ? 4 : 2,
      validationErrors === 0
        ? "Draft is ready for human editorial review."
        : "Draft needs evidence cleanup before editorial review.",
    ),
  ] satisfies ProductQualityMetric[];

  const overallScore =
    metrics.reduce((sum, item) => sum + item.score, 0) / metrics.length;
  const blockers: string[] = [];
  if (validationStatus === "failed") {
    blockers.push("Citation validation failed.");
  }
  if (citationScore < 5) {
    blockers.push("Some factual, numerical, or derived claims lack citations.");
  }

  return ProductQualityEvaluationSchema.parse({
    id: randomUUID(),
    draftId: draft.id,
    overallScore,
    metrics,
    blockers,
    recommendations:
      blockers.length > 0
        ? [
            "Resolve validation blockers before investor or donor outreach.",
            "Use the evidence panel to review unsupported claims and source gaps.",
          ]
        : [
            "Route the draft to human review for tone, completeness, and strategic judgment.",
          ],
    evaluatedAtIso: new Date().toISOString(),
  });
}
