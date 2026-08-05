import { randomUUID } from "node:crypto";

import {
  CitationValidationResultSchema,
  type CitationValidationResult,
  type OpportunityClaim,
  type ValidatedDraft,
  type ValidationFinding,
} from "@/domain";

const numberPattern =
  /(?:\b\d+(?:,\d{3})*(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s?(?:%|percent|million|billion|thousand)\b)/i;

function finding(
  input: Omit<ValidationFinding, "id" | "citationIds"> &
    Partial<Pick<ValidationFinding, "citationIds">>,
): ValidationFinding {
  return {
    id: randomUUID(),
    citationIds: [],
    ...input,
  };
}

function claimRequiresCitation(claim: OpportunityClaim) {
  if (claim.status === "unresolved" || claim.kind === "narrative_framing") {
    return false;
  }

  return (
    claim.kind === "factual" ||
    claim.kind === "numerical" ||
    claim.kind === "derived" ||
    claim.status === "source_provided" ||
    claim.status === "derived_from_sources"
  );
}

export function validateDraftClaims(
  draft: ValidatedDraft,
): CitationValidationResult {
  const findings: ValidationFinding[] = [];
  const claimIds = new Set(draft.claims.map((claim) => claim.id));

  for (const section of draft.sections) {
    for (const claimId of section.claimIds) {
      if (!claimIds.has(claimId)) {
        findings.push(
          finding({
            type: "missing_citation",
            severity: "error",
            fieldKey: `section.${section.sectionKey}`,
            claimId,
            message: `${section.title} references a claim that is not present in the draft claim registry.`,
          }),
        );
      }
    }
  }

  for (const claim of draft.claims) {
    if (claimRequiresCitation(claim) && claim.citationIds.length === 0) {
      findings.push(
        finding({
          type: "missing_citation",
          severity: "error",
          claimId: claim.id,
          message: "Draft claim requires a citation but has none.",
        }),
      );
    }

    if (numberPattern.test(claim.statement) && claim.citationIds.length === 0) {
      findings.push(
        finding({
          type: "unsupported_number",
          severity: "error",
          claimId: claim.id,
          message: "Draft claim contains a number without citation support.",
        }),
      );
    }

    if (
      /funding recipient|investment vehicle|implementing organization|investment manager/i.test(
        claim.statement,
      ) &&
      claim.kind !== "narrative_framing" &&
      claim.status !== "unresolved" &&
      claim.citationIds.length === 0
    ) {
      findings.push(
        finding({
          type: "unsupported_organization_role",
          severity: "error",
          claimId: claim.id,
          message:
            "Draft organization or capital-pathway relationship is not citation-supported.",
        }),
      );
    }
  }

  const hasErrors = findings.some((item) => item.severity === "error");

  return CitationValidationResultSchema.parse({
    status:
      findings.length === 0
        ? "passed"
        : hasErrors
          ? "failed"
          : "passed_with_warnings",
    findings,
    checkedAtIso: new Date().toISOString(),
  });
}
