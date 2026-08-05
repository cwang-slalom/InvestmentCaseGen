import { randomUUID } from "node:crypto";

import {
  OpportunityAssessmentSchema,
  type AssessmentCriterion,
  type EvidenceBackedText,
  type EvidenceGap,
  type Opportunity,
  type OpportunityAssessment,
} from "@/domain";

const criteria = [
  "problem_significance",
  "intervention_clarity",
  "evidence_strength",
  "implementation_readiness",
  "delivery_organization_strength",
  "clarity_of_use_of_funds",
  "ability_to_estimate_impact",
  "urgency_why_now",
  "scalability",
  "sustainability",
  "additionality_of_philanthropic_capital",
  "leverage_created_by_early_investment",
  "clarity_of_funding_recipient_or_investment_vehicle",
] as const;

function backed(value: string, citationIds: string[] = []): EvidenceBackedText {
  return {
    value,
    status: citationIds.length > 0 ? "derived_from_sources" : "unresolved",
    confidence: citationIds.length > 0 ? "medium" : "low",
    citationIds,
  };
}

function scoreEvidence(field?: EvidenceBackedText) {
  if (!field?.value) {
    return 1;
  }

  if (field.citationIds.length === 0) {
    return 2;
  }

  return field.confidence === "high" ? 5 : 4;
}

function hasResolvedFundingPathway(opportunity: Opportunity) {
  return opportunity.fundingPathways.some(
    (pathway) =>
      pathway.pathwayType !== "unresolved_pathway" &&
      pathway.status === "source_provided" &&
      pathway.citationIds.length > 0,
  );
}

function scoreCriterion(
  criterionKey: (typeof criteria)[number],
  opportunity: Opportunity,
): AssessmentCriterion {
  const firstCitation =
    opportunity.claims.flatMap((claim) => claim.citationIds)[0] ??
    opportunity.title.citationIds[0];
  let score = 1;
  let rationale = "Missing or unresolved evidence.";

  switch (criterionKey) {
    case "problem_significance":
      score = scoreEvidence(opportunity.problemStatement);
      rationale = opportunity.problemStatement.value
        ? "Problem statement is present."
        : "Problem statement is unresolved.";
      break;
    case "intervention_clarity":
      score = scoreEvidence(opportunity.proposedIntervention);
      rationale = opportunity.proposedIntervention.value
        ? "Proposed intervention is present."
        : "Proposed intervention is unresolved.";
      break;
    case "evidence_strength":
      score = Math.min(5, Math.max(1, opportunity.claims.length));
      rationale = `${opportunity.claims.length} source-backed claim(s) are available.`;
      break;
    case "implementation_readiness":
      score = opportunity.organizationRoles.some(
        (role) => role.roleType === "implementing_organization",
      )
        ? 4
        : 2;
      rationale =
        score >= 4
          ? "Implementing organization is identified."
          : "Implementing organization is unresolved.";
      break;
    case "delivery_organization_strength":
      score = opportunity.organizationRoles.length >= 2 ? 3 : 1;
      rationale =
        opportunity.organizationRoles.length >= 2
          ? "Multiple organization roles are source-supported."
          : "Delivery organization evidence is limited.";
      break;
    case "clarity_of_use_of_funds":
      score =
        opportunity.totalCost ||
        opportunity.fundingGap ||
        opportunity.currentFunding
          ? 3
          : 1;
      rationale =
        score > 1
          ? "Some cost or funding evidence is present."
          : "Use of funds is not established.";
      break;
    case "ability_to_estimate_impact":
      score = opportunity.expectedOutcomes.length > 0 ? 3 : 1;
      rationale =
        opportunity.expectedOutcomes.length > 0
          ? "Expected outcomes are present."
          : "Expected outcomes are unresolved.";
      break;
    case "urgency_why_now":
      score = scoreEvidence(opportunity.whyNow);
      rationale = opportunity.whyNow.value
        ? "Why-now evidence is present."
        : "Why-now evidence is unresolved.";
      break;
    case "scalability":
      score = /scale|expand|replicate/i.test(
        `${opportunity.summary.value ?? ""} ${opportunity.proposedIntervention.value ?? ""}`,
      )
        ? 3
        : 1;
      rationale =
        score > 1
          ? "Scale or expansion language appears in source-supported fields."
          : "Scalability is unresolved.";
      break;
    case "sustainability":
      score = /sustain|government|institution|market|revenue/i.test(
        `${opportunity.summary.value ?? ""} ${opportunity.claims.map((claim) => claim.statement).join(" ")}`,
      )
        ? 3
        : 1;
      rationale =
        score > 1
          ? "Some sustainability signal appears in source-supported text."
          : "Sustainability is unresolved.";
      break;
    case "additionality_of_philanthropic_capital":
      score = /philanthrop|catalytic|additional|de-risk|early/i.test(
        `${opportunity.investorRelevance.value ?? ""} ${opportunity.claims.map((claim) => claim.statement).join(" ")}`,
      )
        ? 3
        : 1;
      rationale =
        score > 1
          ? "Additionality signal appears in source-supported text."
          : "Additionality of philanthropic capital is unresolved.";
      break;
    case "leverage_created_by_early_investment":
      score = /leverage|unlock|cataly|seed|early/i.test(
        `${opportunity.investorRelevance.value ?? ""} ${opportunity.claims.map((claim) => claim.statement).join(" ")}`,
      )
        ? 3
        : 1;
      rationale =
        score > 1
          ? "Leverage or catalytic language appears in source-supported text."
          : "Leverage from early investment is unresolved.";
      break;
    case "clarity_of_funding_recipient_or_investment_vehicle":
      score = hasResolvedFundingPathway(opportunity) ? 5 : 1;
      rationale =
        score === 5
          ? "Funding recipient or investment vehicle is source-supported."
          : "Funding recipient or investment vehicle is not established.";
      break;
  }

  return {
    criterionKey,
    score,
    rationale: backed(rationale, firstCitation ? [firstCitation] : []),
    citationIds: firstCitation ? [firstCitation] : [],
  };
}

function gap(description: string, fieldKey: string): EvidenceGap {
  return {
    id: randomUUID(),
    fieldKey,
    description,
    severity: "medium",
    suggestedNextStep: "Resolve before investor outreach.",
  };
}

export function assessOpportunityInvestability(
  opportunity: Opportunity,
): OpportunityAssessment {
  const scoredCriteria = criteria.map((criterionKey) =>
    scoreCriterion(criterionKey, opportunity),
  );
  const average =
    scoredCriteria.reduce((sum, criterion) => sum + criterion.score, 0) /
    scoredCriteria.length;
  const fundingClarity = scoredCriteria.find(
    (criterion) =>
      criterion.criterionKey ===
      "clarity_of_funding_recipient_or_investment_vehicle",
  )?.score;
  const readyForInvestmentCaseDevelopment = average >= 2.6;
  const readyForInvestorOutreach = average >= 4 && fundingClarity === 5;
  const readinessLevel = readyForInvestorOutreach
    ? "ready_for_investor_outreach"
    : readyForInvestmentCaseDevelopment
      ? "promising_but_not_investor_ready"
      : average >= 2
        ? "requires_substantial_development"
        : "insufficient_evidence";
  const weakCriteria = scoredCriteria.filter(
    (criterion) => criterion.score <= 2,
  );

  return OpportunityAssessmentSchema.parse({
    opportunityId: opportunity.id,
    readinessLevel,
    strengths: scoredCriteria
      .filter((criterion) => criterion.score >= 4)
      .map((criterion) =>
        backed(
          `${criterion.criterionKey.replaceAll("_", " ")} is relatively strong.`,
          criterion.citationIds,
        ),
      ),
    concerns: weakCriteria.map((criterion) =>
      backed(
        `${criterion.criterionKey.replaceAll("_", " ")} needs more evidence.`,
        criterion.citationIds,
      ),
    ),
    weaknesses: weakCriteria.map((criterion) =>
      backed(
        `${criterion.criterionKey.replaceAll("_", " ")} scored ${criterion.score}/5.`,
        criterion.citationIds,
      ),
    ),
    criteria: scoredCriteria,
    overallRationale: backed(
      `Average investability score is ${average.toFixed(1)}/5. ${readyForInvestorOutreach ? "Ready for investor outreach." : readyForInvestmentCaseDevelopment ? "Ready for investment-case development with gaps." : "Not ready for investment-case development."}`,
      opportunity.title.citationIds,
    ),
    missingEvidence: [
      ...opportunity.evidenceGaps,
      ...weakCriteria.map((criterion) =>
        gap(
          `${criterion.criterionKey.replaceAll("_", " ")} requires stronger source evidence.`,
          criterion.criterionKey,
        ),
      ),
    ],
    nextDiligenceSteps: weakCriteria.map(
      (criterion) =>
        `Resolve ${criterion.criterionKey.replaceAll("_", " ")} evidence gap.`,
    ),
    recommendedNextSteps: weakCriteria.map(
      (criterion) =>
        `Resolve ${criterion.criterionKey.replaceAll("_", " ")} evidence gap.`,
    ),
    readyForInvestmentCaseDevelopment,
    readyForInvestorOutreach,
  });
}
