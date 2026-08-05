import { z } from "zod";

export const OutputTypeSchema = z.enum([
  "executive_investment_case",
  "opportunity_spotlight",
]);

export const FieldStatusSchema = z.enum([
  "source_provided",
  "derived_from_sources",
  "generated_framing",
  "unresolved",
  "conflicting",
  "not_applicable",
]);

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const ClaimKindSchema = z.enum([
  "factual",
  "numerical",
  "derived",
  "narrative_framing",
  "recommendation",
]);

export const ClaimValidationStatusSchema = z.enum([
  "supported",
  "partially_supported",
  "unsupported",
  "conflicting",
  "not_checked",
]);

export const CitationSchema = z.object({
  id: z.string(),
  sourceDocumentId: z.string(),
  filename: z.string(),
  pageNumber: z.number().int().positive().optional(),
  slideNumber: z.number().int().positive().optional(),
  sectionHeading: z.string().optional(),
  chunkId: z.string().optional(),
  excerpt: z.string().min(1),
});

export const EvidenceBackedTextSchema = z.object({
  value: z.string().optional(),
  status: FieldStatusSchema,
  confidence: ConfidenceSchema,
  citationIds: z.array(z.string()).default([]),
  note: z.string().optional(),
});

export const GeographySchema = z.object({
  label: z.string().min(1),
  status: FieldStatusSchema,
  citationIds: z.array(z.string()).default([]),
});

export const TimePeriodSchema = z.object({
  label: z.string().optional(),
  startDateIso: z.string().optional(),
  endDateIso: z.string().optional(),
  durationText: z.string().optional(),
  status: FieldStatusSchema,
  citationIds: z.array(z.string()).default([]),
});

export const OrganizationRoleTypeSchema = z.enum([
  "concept_owner",
  "sponsoring_team",
  "implementing_organization",
  "delivery_partner",
  "investment_manager",
  "fiscal_sponsor",
]);

export const OrganizationRoleSchema = z.object({
  id: z.string(),
  organizationName: z.string().min(1),
  roleType: OrganizationRoleTypeSchema,
  status: FieldStatusSchema,
  confidence: ConfidenceSchema,
  citationIds: z.array(z.string()).min(1),
  note: z.string().optional(),
});

export const FundingPathwayTypeSchema = z.enum([
  "funding_recipient",
  "investment_vehicle",
  "pooled_fund",
  "government_program",
  "research_program",
  "unresolved_pathway",
]);

export const FundingPathwaySchema = z.object({
  id: z.string(),
  pathwayType: FundingPathwayTypeSchema,
  name: z.string().optional(),
  relatedOrganizationRoleId: z.string().optional(),
  status: FieldStatusSchema,
  confidence: ConfidenceSchema,
  citationIds: z.array(z.string()).default([]),
  note: z.string().optional(),
});

export const BeneficiaryPopulationSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  description: z.string().optional(),
  geographies: z.array(GeographySchema).default([]),
  estimatedSizeText: z.string().optional(),
  status: FieldStatusSchema,
  confidence: ConfidenceSchema,
  citationIds: z.array(z.string()).min(1),
});

export const CostTypeSchema = z.enum([
  "total_program_cost",
  "current_funding",
  "funding_gap",
  "annual_operating_cost",
  "capital_cost",
  "unit_cost",
  "other",
]);

export const UnitBasisSchema = z.enum([
  "per_beneficiary",
  "per_household",
  "per_facility",
  "per_health_worker",
  "per_site",
  "per_month",
  "per_year",
  "other",
]);

export const MoneyRangeSchema = z.object({
  minimum: z.number().nonnegative(),
  maximum: z.number().nonnegative(),
}).refine((value) => value.maximum >= value.minimum, {
  message: "Money range maximum must be greater than or equal to minimum.",
});

export const MoneyAmountSchema = z.object({
  currency: z.string().length(3).optional(),
  amount: z.number().nonnegative().optional(),
  range: MoneyRangeSchema.optional(),
  displayText: z.string().optional(),
  geography: z.array(GeographySchema).default([]),
  timePeriod: TimePeriodSchema.optional(),
  costType: CostTypeSchema.optional(),
  unitBasis: UnitBasisSchema.optional(),
  unitAmount: z.number().nonnegative().optional(),
  status: FieldStatusSchema,
  confidence: ConfidenceSchema,
  isDerived: z.boolean().default(false),
  derivedFromClaimIds: z.array(z.string()).default([]),
  calculationNote: z.string().optional(),
  citationIds: z.array(z.string()).default([]),
  validationStatus: ClaimValidationStatusSchema,
});

export const OpportunityClaimSchema = z.object({
  id: z.string(),
  statement: z.string().min(1),
  kind: ClaimKindSchema,
  status: FieldStatusSchema,
  validationStatus: ClaimValidationStatusSchema,
  citationIds: z.array(z.string()).default([]),
  derivedFromClaimIds: z.array(z.string()).default([]),
  note: z.string().optional(),
});

export const RiskCategorySchema = z.enum([
  "scientific_and_technical",
  "regulatory",
  "organizational_and_operational",
  "commercial_and_demand",
  "delivery_and_implementation",
  "evidence_and_measurement",
  "reputational_and_stakeholder",
]);

export const RiskLevelSchema = z.enum(["low", "medium", "high", "unresolved"]);

export const RiskAssessmentSchema = z.object({
  id: z.string(),
  category: RiskCategorySchema,
  level: RiskLevelSchema,
  rationale: EvidenceBackedTextSchema,
  mitigation: EvidenceBackedTextSchema.optional(),
  citationIds: z.array(z.string()).default([]),
});

export const EvidenceGapSchema = z.object({
  id: z.string(),
  fieldKey: z.string(),
  description: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  suggestedNextStep: z.string().optional(),
});

export const OpportunitySchema = z.object({
  id: z.string(),
  title: EvidenceBackedTextSchema,
  summary: EvidenceBackedTextSchema,
  problemStatement: EvidenceBackedTextSchema,
  proposedIntervention: EvidenceBackedTextSchema,
  whyNow: EvidenceBackedTextSchema,
  investorRelevance: EvidenceBackedTextSchema,
  expectedOutcomes: z.array(EvidenceBackedTextSchema).default([]),
  longTermImpact: z.array(EvidenceBackedTextSchema).default([]),
  geographies: z.array(GeographySchema).default([]),
  timeline: TimePeriodSchema.optional(),
  organizationRoles: z.array(OrganizationRoleSchema).default([]),
  fundingPathways: z.array(FundingPathwaySchema).default([]),
  beneficiaryPopulations: z.array(BeneficiaryPopulationSchema).default([]),
  totalCost: MoneyAmountSchema.optional(),
  currentFunding: MoneyAmountSchema.optional(),
  fundingGap: MoneyAmountSchema.optional(),
  claims: z.array(OpportunityClaimSchema).default([]),
  risks: z.array(RiskAssessmentSchema).default([]),
  evidenceGaps: z.array(EvidenceGapSchema).default([]),
  overallStatus: FieldStatusSchema,
});

export const ReadinessLevelSchema = z.enum([
  "ready_for_investor_outreach",
  "promising_but_not_investor_ready",
  "requires_substantial_development",
  "insufficient_evidence",
]);

export const AssessmentCriterionSchema = z.object({
  criterionKey: z.enum([
    "problem_significance",
    "intervention_clarity",
    "evidence_strength",
    "implementation_readiness",
    "capital_use_clarity",
    "funding_pathway_clarity",
    "measurable_outcomes",
    "timing_and_urgency",
  ]),
  score: z.number().int().min(1).max(5),
  rationale: EvidenceBackedTextSchema,
  citationIds: z.array(z.string()).default([]),
});

export const OpportunityAssessmentSchema = z.object({
  opportunityId: z.string(),
  readinessLevel: ReadinessLevelSchema,
  strengths: z.array(EvidenceBackedTextSchema).default([]),
  concerns: z.array(EvidenceBackedTextSchema).default([]),
  criteria: z.array(AssessmentCriterionSchema).default([]),
  overallRationale: EvidenceBackedTextSchema,
  nextDiligenceSteps: z.array(z.string()).default([]),
});

export const DraftSectionSchema = z.object({
  id: z.string(),
  sectionKey: z.string(),
  title: z.string(),
  renderedMarkdown: z.string().min(1),
  claimIds: z.array(z.string()).min(1),
  evidenceGapIds: z.array(z.string()).default([]),
  warningText: z.array(z.string()).default([]),
  orderIndex: z.number().int().nonnegative(),
});

export const ValidatedDraftSchema = z.object({
  id: z.string(),
  opportunityId: z.string(),
  outputType: OutputTypeSchema,
  title: z.string(),
  sectionOrder: z.array(z.string()).default([]),
  sections: z.array(DraftSectionSchema).default([]),
  claims: z.array(OpportunityClaimSchema).default([]),
  citations: z.array(CitationSchema).default([]),
  evidenceGaps: z.array(EvidenceGapSchema).default([]),
  draftNotice: z.literal("Draft for human review"),
});

export const GenerationRecordSchema = z.object({
  id: z.string(),
  runType: z.enum([
    "extract_opportunities",
    "assess_opportunity",
    "render_executive_investment_case",
    "render_opportunity_spotlight",
    "validate_draft_claims",
  ]),
  modelProvider: z.string(),
  modelName: z.string(),
  promptVersion: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  storedPayloadMode: z.enum(["validated_outputs_only", "redacted_development"]),
  redactedResponseJson: z.unknown().optional(),
});
