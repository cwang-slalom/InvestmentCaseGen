import { randomUUID } from "node:crypto";

import {
  CitationValidationResultSchema,
  type CitationValidationResult,
  type Opportunity,
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

function requiresCitation(status: string) {
  return status === "source_provided" || status === "derived_from_sources";
}

export function validateOpportunityCitations(
  opportunity: Opportunity,
): CitationValidationResult {
  const findings: ValidationFinding[] = [];
  const evidenceFields = [
    ["title", opportunity.title],
    ["summary", opportunity.summary],
    ["problemStatement", opportunity.problemStatement],
    ["proposedIntervention", opportunity.proposedIntervention],
    ["whyNow", opportunity.whyNow],
    ["investorRelevance", opportunity.investorRelevance],
  ] as const;

  for (const [fieldKey, field] of evidenceFields) {
    if (
      field.value &&
      requiresCitation(field.status) &&
      field.citationIds.length === 0
    ) {
      findings.push(
        finding({
          type: "missing_citation",
          severity: "error",
          fieldKey,
          message: `${fieldKey} is marked ${field.status} but has no citation.`,
        }),
      );
    }

    if (
      field.value &&
      numberPattern.test(field.value) &&
      field.citationIds.length === 0
    ) {
      findings.push(
        finding({
          type: "unsupported_number",
          severity: "error",
          fieldKey,
          message: `${fieldKey} contains a number without citation support.`,
        }),
      );
    }
  }

  for (const claim of opportunity.claims) {
    if (
      claim.citationIds.length === 0 &&
      claim.validationStatus !== "not_checked"
    ) {
      findings.push(
        finding({
          type: "missing_citation",
          severity: "error",
          claimId: claim.id,
          message: "Claim has no supporting citation.",
        }),
      );
    }

    if (numberPattern.test(claim.statement) && claim.citationIds.length === 0) {
      findings.push(
        finding({
          type: "unsupported_number",
          severity: "error",
          claimId: claim.id,
          message: "Numerical claim has no supporting citation.",
        }),
      );
    }
  }

  for (const role of opportunity.organizationRoles) {
    if (role.citationIds.length === 0) {
      findings.push(
        finding({
          type: "unsupported_organization_role",
          severity: "error",
          fieldKey: `organization_role.${role.roleType}`,
          message: `${role.roleType.replaceAll("_", " ")} for ${role.organizationName} has no citation.`,
        }),
      );
    }
  }

  for (const pathway of opportunity.fundingPathways) {
    if (
      pathway.pathwayType !== "unresolved_pathway" &&
      pathway.citationIds.length === 0
    ) {
      findings.push(
        finding({
          type: "unsupported_funding_pathway",
          severity: "error",
          fieldKey: `funding_pathway.${pathway.pathwayType}`,
          message: `${pathway.pathwayType.replaceAll("_", " ")} has no citation.`,
        }),
      );
    }
  }

  const rolesByType = new Map<string, Set<string>>();
  for (const role of opportunity.organizationRoles) {
    const names = rolesByType.get(role.roleType) ?? new Set<string>();
    names.add(role.organizationName.toLowerCase());
    rolesByType.set(role.roleType, names);
  }

  for (const [roleType, names] of rolesByType.entries()) {
    if (names.size > 1) {
      findings.push(
        finding({
          type: "conflicting_evidence",
          severity: "warning",
          fieldKey: `organization_role.${roleType}`,
          message: `Multiple organizations are cited as ${roleType.replaceAll("_", " ")}.`,
        }),
      );
    }
  }

  const hasErrors = findings.some((item) => item.severity === "error");
  const status =
    findings.length === 0
      ? "passed"
      : hasErrors
        ? "failed"
        : "passed_with_warnings";

  return CitationValidationResultSchema.parse({
    status,
    findings,
    checkedAtIso: new Date().toISOString(),
  });
}
