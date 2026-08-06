import { z } from "zod";

export const OutputTypeSchema = z.enum([
  "executive_investment_case",
  "opportunity_spotlight",
  "investment_prospectus",
  "donor_deck",
  "donor_one_pager",
  "meeting_talking_points",
  "source_appendix",
  "concept_note",
  "board_brief",
  "hnwi_donor_teaser",
]);

export const InvestorSegmentSchema = z.enum([
  "general_donor",
  "philanthropic_foundation",
  "us_foundation_program_officer",
  "us_major_donor",
  "donor_advised_fund_advisor",
  "impact_investor",
  "government_donor",
  "corporate_philanthropy",
]);

export const AudienceFamiliaritySchema = z.enum([
  "new_to_topic",
  "familiar_with_issue",
  "technical_expert",
]);

export const AudienceScaleSchema = z.enum([
  "exploratory",
  "major_donor",
  "big_bet",
]);

export const NarrativeToneSchema = z.enum([
  "balanced",
  "warm",
  "direct",
  "visionary",
]);

export const NarrativeAngleSchema = z.enum([
  "catalytic_philanthropy",
  "systems_change",
  "scale_pathway",
  "innovation",
  "policy_leverage",
  "proof_of_concept",
  "evidence_and_diligence",
  "beneficiary_urgency",
]);

export const DEFAULT_AUDIENCE_TAILORING = {
  familiarity: "new_to_topic",
  scale: "exploratory",
  tone: "balanced",
} as const;

export const DEFAULT_PROSPECTUS_BUILDER = {
  narrativeAngle: "catalytic_philanthropy",
} as const;

export const AudienceTailoringSchema = z
  .object({
    familiarity: AudienceFamiliaritySchema.default(
      DEFAULT_AUDIENCE_TAILORING.familiarity,
    ),
    scale: AudienceScaleSchema.default(DEFAULT_AUDIENCE_TAILORING.scale),
    tone: NarrativeToneSchema.default(DEFAULT_AUDIENCE_TAILORING.tone),
    customInstructions: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.string().trim().max(500).optional(),
      )
      .optional(),
  })
  .default(DEFAULT_AUDIENCE_TAILORING);

export const ProspectusBuilderSchema = z
  .object({
    variantLabel: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.string().trim().max(120).optional(),
      )
      .optional(),
    narrativeAngle: NarrativeAngleSchema.default(
      DEFAULT_PROSPECTUS_BUILDER.narrativeAngle,
    ),
    intendedAudience: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.string().trim().max(160).optional(),
      )
      .optional(),
    callToAction: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.string().trim().max(240).optional(),
      )
      .optional(),
    positioningNotes: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.string().trim().max(700).optional(),
      )
      .optional(),
  })
  .default(DEFAULT_PROSPECTUS_BUILDER);

export const DraftVariantSchema = z.object({
  label: z.string().min(1).max(140),
  formatLabel: z.string().min(1).max(120),
  audienceProfileLabel: z.string().min(1).max(120),
  narrativeAngle: NarrativeAngleSchema,
  createdAtIso: z.string(),
});

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
  humanReviewed: z.boolean().optional(),
  reviewedAtIso: z.string().optional(),
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
  "nonprofit",
  "research_institution",
  "product_developer",
  "fiscal_sponsor_vehicle",
  "other_vehicle",
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

export const MoneyRangeSchema = z
  .object({
    minimum: z.number().nonnegative(),
    maximum: z.number().nonnegative(),
  })
  .refine((value) => value.maximum >= value.minimum, {
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
    "delivery_organization_strength",
    "capital_use_clarity",
    "clarity_of_use_of_funds",
    "funding_pathway_clarity",
    "clarity_of_funding_recipient_or_investment_vehicle",
    "measurable_outcomes",
    "ability_to_estimate_impact",
    "timing_and_urgency",
    "urgency_why_now",
    "scalability",
    "sustainability",
    "additionality_of_philanthropic_capital",
    "leverage_created_by_early_investment",
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
  weaknesses: z.array(EvidenceBackedTextSchema).default([]),
  criteria: z.array(AssessmentCriterionSchema).default([]),
  overallRationale: EvidenceBackedTextSchema,
  missingEvidence: z.array(EvidenceGapSchema).default([]),
  nextDiligenceSteps: z.array(z.string()).default([]),
  recommendedNextSteps: z.array(z.string()).default([]),
  readyForInvestmentCaseDevelopment: z.boolean().default(false),
  readyForInvestorOutreach: z.boolean().default(false),
});

export const InvestabilityAssessmentSchema = OpportunityAssessmentSchema;

export const ValidationFindingSeveritySchema = z.enum([
  "info",
  "warning",
  "error",
]);

export const ValidationFindingTypeSchema = z.enum([
  "missing_citation",
  "unsupported_number",
  "unsupported_organization_role",
  "unsupported_funding_pathway",
  "conflicting_evidence",
]);

export const ValidationFindingSchema = z.object({
  id: z.string(),
  type: ValidationFindingTypeSchema,
  severity: ValidationFindingSeveritySchema,
  message: z.string().min(1),
  fieldKey: z.string().optional(),
  claimId: z.string().optional(),
  citationIds: z.array(z.string()).default([]),
});

export const CitationValidationResultSchema = z.object({
  status: z.enum(["passed", "passed_with_warnings", "failed"]),
  findings: z.array(ValidationFindingSchema).default([]),
  checkedAtIso: z.string(),
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
  regenerationCount: z.number().int().nonnegative().default(0),
  lastRegeneratedAtIso: z.string().optional(),
});

export const ProductQualityMetricKeySchema = z.enum([
  "factual_support",
  "citation_coverage",
  "role_distinction",
  "unresolved_gap_visibility",
  "completeness",
  "source_faithfulness",
  "donor_persuasiveness",
  "edit_readiness",
]);

export const ProductQualityMetricSchema = z.object({
  metricKey: ProductQualityMetricKeySchema,
  score: z.number().int().min(1).max(5),
  rationale: EvidenceBackedTextSchema,
  citationIds: z.array(z.string()).default([]),
});

export const ProductQualityEvaluationSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  overallScore: z.number().min(1).max(5),
  metrics: z.array(ProductQualityMetricSchema).default([]),
  blockers: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  evaluatedAtIso: z.string(),
});

export const InvestmentCaseWriterStatusSchema = z.enum([
  "ready",
  "needs_information",
  "blocked",
]);

export const InvestmentCaseRequiredContentCheckSchema = z.object({
  investment_team_present: z.boolean(),
  technical_team_present: z.boolean(),
  diligence_present: z.boolean(),
});

export const InvestmentCaseDraftBlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  heading: z.string(),
  body: z.string(),
  citations: z.array(z.string()).default([]),
  locked: z.boolean().default(false),
});

export const InvestmentCaseQualityReviewSchema = z.object({
  changed_facts: z.array(z.string()).default([]),
  unsupported_claims: z.array(z.string()).default([]),
  missing_citations: z.array(z.string()).default([]),
  tone_issues: z.array(z.string()).default([]),
  direct_appeals: z.array(z.string()).default([]),
  repetition: z.array(z.string()).default([]),
});

export const InvestmentCaseWriterOutputSchema = z.object({
  status: InvestmentCaseWriterStatusSchema,
  source_summary: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
  information_needed: z.array(z.string()).default([]),
  required_content_check: InvestmentCaseRequiredContentCheckSchema,
  outline: z.array(z.string()).default([]),
  draft_blocks: z.array(InvestmentCaseDraftBlockSchema).default([]),
  quality_review: InvestmentCaseQualityReviewSchema,
});

export const IntegrityReviewDecisionSchema = z.enum([
  "pass",
  "revise",
  "blocked",
]);

export const IntegrityReviewFindingSeveritySchema = z.enum([
  "BLOCKING",
  "WARNING",
  "EDITORIAL",
]);

export const IntegrityReviewFindingSchema = z.object({
  severity: IntegrityReviewFindingSeveritySchema,
  type: z.string().min(1),
  block_id: z.string(),
  description: z.string().min(1),
  source_reference: z.string(),
  recommended_action: z.string().min(1),
});

export const IntegrityReviewerOutputSchema = z.object({
  decision: IntegrityReviewDecisionSchema,
  findings: z.array(IntegrityReviewFindingSchema).default([]),
});

const MemoryValueSchema = z.record(z.string(), z.unknown());

export const MemoryScopeSchema = z.enum([
  "product",
  "workspace",
  "case",
  "session",
]);

export const MemorySourceSchema = z.enum([
  "user",
  "source_document",
  "administrator",
]);

export const MemoryStatusSchema = z.enum([
  "proposed",
  "approved",
  "deprecated",
]);

export const MemoryRecordSchema = z.object({
  id: z.string().min(1),
  scope: MemoryScopeSchema,
  category: z.string().min(1),
  value: MemoryValueSchema,
  source: MemorySourceSchema,
  source_reference: z.string(),
  status: MemoryStatusSchema,
  approved_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string().nullable(),
});

export const ProductPolicySchema = z.object({
  universal_factual_integrity_rules: z.array(z.string()).default([]),
  generic_editorial_principles: z.array(z.string()).default([]),
  prompt_version: z.string().min(1),
});

export const WorkspaceProfileMemorySchema = z.object({
  audience: MemoryValueSchema.default({}),
  brand: MemoryValueSchema.default({}),
  organization_vocabulary: MemoryValueSchema.default({}),
  approved_vehicles: z.array(MemoryValueSchema).default([]),
  editorial_preferences: MemoryValueSchema.default({}),
  approved_benchmark_cases: z.array(z.string()).default([]),
});

export const ProjectStateMemorySchema = z.object({
  current_case_status: z.string().optional(),
  open_questions: z.array(z.string()).default([]),
  requested_changes: z.array(z.string()).default([]),
  reviewers: z.array(z.string()).default([]),
  deadlines: z.array(z.string()).default([]),
});

export const CaseKnowledgeMemorySchema = z.object({
  source_documents: z.array(MemoryValueSchema).default([]),
  source_chunks: z.array(MemoryValueSchema).default([]),
  fact_ledger: z.array(MemoryValueSchema).default([]),
  locked_facts: z.array(MemoryValueSchema).default([]),
  citations: z.array(MemoryValueSchema).default([]),
  approved_corrections: z.array(MemoryValueSchema).default([]),
});

export const SessionInstructionMemorySchema = z.object({
  current_requested_edit: z.string().optional(),
  target_length: z.string().optional(),
  selected_sections: z.array(z.string()).default([]),
  temporary_preferences: MemoryValueSchema.default({}),
});

export const DonorFollowUpTopicSchema = z.enum([
  "funding_pathway",
  "budget",
  "impact_metrics",
  "evidence",
  "risk",
  "implementation",
  "timeline",
  "audience_fit",
  "other",
]);

export const DonorFollowUpActionSchema = z.enum([
  "draft_updated",
  "response_prepared",
  "needs_source_evidence",
  "human_review_required",
]);

export const DonorFollowUpUpdateSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  donorName: z.string().optional(),
  message: z.string().min(1),
  receivedAtIso: z.string(),
  topics: z.array(DonorFollowUpTopicSchema).default([]),
  impactedSectionKeys: z.array(z.string()).default([]),
  sourceClaimIds: z.array(z.string()).default([]),
  sourceBackedSummary: z.string().optional(),
  proposedResponseMarkdown: z.string().min(1),
  unresolvedRequests: z.array(EvidenceGapSchema).default([]),
  actions: z.array(DonorFollowUpActionSchema).default([]),
  createdClaimIds: z.array(z.string()).default([]),
  createdSectionId: z.string().optional(),
  appliedAtIso: z.string().optional(),
  warnings: z.array(z.string()).default([]),
});

export const ValidatedDraftSchema = z.object({
  id: z.string(),
  opportunityId: z.string(),
  outputType: OutputTypeSchema,
  investorSegment: InvestorSegmentSchema.default("general_donor"),
  audienceTailoring: AudienceTailoringSchema.default(
    DEFAULT_AUDIENCE_TAILORING,
  ),
  prospectusBuilder: ProspectusBuilderSchema.default(
    DEFAULT_PROSPECTUS_BUILDER,
  ),
  variant: DraftVariantSchema.optional(),
  title: z.string(),
  sectionOrder: z.array(z.string()).default([]),
  sections: z.array(DraftSectionSchema).default([]),
  claims: z.array(OpportunityClaimSchema).default([]),
  citations: z.array(CitationSchema).default([]),
  evidenceGaps: z.array(EvidenceGapSchema).default([]),
  validation: CitationValidationResultSchema.optional(),
  productQualityEvaluation: ProductQualityEvaluationSchema.optional(),
  narrativeChanges: z.array(z.string()).default([]),
  followUpUpdates: z.array(DonorFollowUpUpdateSchema).default([]),
  generatedAtIso: z.string(),
  draftNotice: z.literal("Draft for human review"),
});

export const GenerationRecordSchema = z.object({
  id: z.string(),
  runType: z.enum([
    "extract_opportunities",
    "assess_opportunity",
    "render_executive_investment_case",
    "render_opportunity_spotlight",
    "render_investment_prospectus",
    "render_donor_deck",
    "render_donor_one_pager",
    "render_meeting_talking_points",
    "render_source_appendix",
    "render_concept_note",
    "render_board_brief",
    "render_hnwi_donor_teaser",
    "strengthen_narrative",
    "regenerate_draft_section",
    "validate_draft_claims",
    "apply_donor_followup",
    "export_docx",
  ]),
  modelProvider: z.string(),
  modelName: z.string(),
  promptVersion: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  storedPayloadMode: z.enum(["validated_outputs_only", "redacted_development"]),
  redactedResponseJson: z.unknown().optional(),
});

export const GenerationRunSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  opportunityId: z.string().optional(),
  runType: z.enum([
    "extract_opportunities",
    "assess_opportunity",
    "validate_citations",
    "render_executive_investment_case",
    "render_opportunity_spotlight",
    "render_investment_prospectus",
    "render_donor_deck",
    "render_donor_one_pager",
    "render_meeting_talking_points",
    "render_source_appendix",
    "render_concept_note",
    "render_board_brief",
    "render_hnwi_donor_teaser",
    "strengthen_narrative",
    "regenerate_draft_section",
    "validate_draft_claims",
    "apply_donor_followup",
    "export_docx",
  ]),
  promptName: z.string().min(1),
  promptVersion: z.string().min(1),
  modelProvider: z.string().min(1),
  modelName: z.string().min(1),
  inputChunkIds: z.array(z.string()).default([]),
  validationResult: CitationValidationResultSchema.optional(),
  status: z.enum(["pending", "completed", "failed"]),
  storedPayloadMode: z.enum(["validated_outputs_only", "redacted_development"]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const UserRoleSchema = z.enum(["admin", "member"]);

export const ProjectAccessRoleSchema = z.enum(["owner", "editor", "viewer"]);

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  systemRole: UserRoleSchema,
  active: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ProjectMembershipSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  role: ProjectAccessRoleSchema,
  createdAt: z.coerce.date(),
});

export const ProjectMembershipWithUserSchema = ProjectMembershipSchema.extend({
  user: UserSchema,
});

export const DocumentFormatSchema = z.enum(["pdf", "docx", "pptx", "txt"]);

export const DocumentStatusSchema = z.enum([
  "uploaded",
  "parsed",
  "failed",
  "rejected",
]);

export const DocumentWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  blocking: z.boolean().default(false),
});

export const DocumentHeadingSchema = z.object({
  text: z.string().min(1),
  level: z.number().int().positive().optional(),
  pageNumber: z.number().int().positive().optional(),
  slideNumber: z.number().int().positive().optional(),
});

export const DocumentParserMetadataSchema = z.object({
  parserName: z.string().min(1),
  parserVersion: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  slideCount: z.number().int().positive().optional(),
  wordCount: z.number().int().nonnegative().default(0),
  characterCount: z.number().int().nonnegative().default(0),
  textDensity: z.number().nonnegative().optional(),
  headings: z.array(DocumentHeadingSchema).default([]),
});

export const SourceChunkMetadataSchema = z.object({
  pageNumber: z.number().int().positive().optional(),
  slideNumber: z.number().int().positive().optional(),
  sectionHeading: z.string().optional(),
  wordCount: z.number().int().nonnegative().default(0),
});

export const SourceDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileExtension: DocumentFormatSchema,
  sizeBytes: z.number().int().nonnegative(),
  storagePath: z.string().min(1),
  parserType: DocumentFormatSchema,
  status: DocumentStatusSchema,
  warnings: z.array(DocumentWarningSchema).default([]),
  parserMetadata: DocumentParserMetadataSchema.optional(),
  errorMessage: z.string().optional(),
  textHash: z.string().optional(),
  characterCount: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const SourceChunkSchema = z.object({
  id: z.string(),
  sourceDocumentId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  text: z.string().min(1),
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().positive(),
  citation: CitationSchema,
  metadata: SourceChunkMetadataSchema.default({
    wordCount: 0,
  }),
  createdAt: z.coerce.date(),
});

export const DocumentUploadResultSchema = z.object({
  document: SourceDocumentSchema,
  chunkCount: z.number().int().nonnegative(),
});

export const OpportunityRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().min(1),
  overallStatus: FieldStatusSchema,
  opportunity: OpportunitySchema,
  assessment: OpportunityAssessmentSchema.optional(),
  validation: CitationValidationResultSchema.optional(),
  reviewMetadata: z
    .object({
      humanReviewedFields: z.array(z.string()).default([]),
      lastReviewedAtIso: z.string().optional(),
    })
    .optional(),
  sourceDocumentIds: z.array(z.string()).default([]),
  extractionRunId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const DraftRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  opportunityRecordId: z.string(),
  opportunityId: z.string(),
  outputType: OutputTypeSchema,
  investorSegment: InvestorSegmentSchema,
  draft: ValidatedDraftSchema,
  generationRunId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type OutputType = z.infer<typeof OutputTypeSchema>;
export type InvestorSegment = z.infer<typeof InvestorSegmentSchema>;
export type AudienceFamiliarity = z.infer<typeof AudienceFamiliaritySchema>;
export type AudienceScale = z.infer<typeof AudienceScaleSchema>;
export type NarrativeTone = z.infer<typeof NarrativeToneSchema>;
export type NarrativeAngle = z.infer<typeof NarrativeAngleSchema>;
export type AudienceTailoring = z.infer<typeof AudienceTailoringSchema>;
export type ProspectusBuilder = z.infer<typeof ProspectusBuilderSchema>;
export type DraftVariant = z.infer<typeof DraftVariantSchema>;
export type FieldStatus = z.infer<typeof FieldStatusSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type ClaimKind = z.infer<typeof ClaimKindSchema>;
export type ClaimValidationStatus = z.infer<typeof ClaimValidationStatusSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type EvidenceBackedText = z.infer<typeof EvidenceBackedTextSchema>;
export type Geography = z.infer<typeof GeographySchema>;
export type TimePeriod = z.infer<typeof TimePeriodSchema>;
export type OrganizationRoleType = z.infer<typeof OrganizationRoleTypeSchema>;
export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;
export type FundingPathwayType = z.infer<typeof FundingPathwayTypeSchema>;
export type FundingPathway = z.infer<typeof FundingPathwaySchema>;
export type BeneficiaryPopulation = z.infer<typeof BeneficiaryPopulationSchema>;
export type CostType = z.infer<typeof CostTypeSchema>;
export type UnitBasis = z.infer<typeof UnitBasisSchema>;
export type MoneyRange = z.infer<typeof MoneyRangeSchema>;
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;
export type OpportunityClaim = z.infer<typeof OpportunityClaimSchema>;
export type RiskCategory = z.infer<typeof RiskCategorySchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
export type EvidenceGap = z.infer<typeof EvidenceGapSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type ReadinessLevel = z.infer<typeof ReadinessLevelSchema>;
export type AssessmentCriterion = z.infer<typeof AssessmentCriterionSchema>;
export type OpportunityAssessment = z.infer<typeof OpportunityAssessmentSchema>;
export type InvestabilityAssessment = z.infer<
  typeof InvestabilityAssessmentSchema
>;
export type DraftSection = z.infer<typeof DraftSectionSchema>;
export type ProductQualityMetricKey = z.infer<
  typeof ProductQualityMetricKeySchema
>;
export type ProductQualityMetric = z.infer<typeof ProductQualityMetricSchema>;
export type ProductQualityEvaluation = z.infer<
  typeof ProductQualityEvaluationSchema
>;
export type DonorFollowUpTopic = z.infer<typeof DonorFollowUpTopicSchema>;
export type DonorFollowUpAction = z.infer<typeof DonorFollowUpActionSchema>;
export type DonorFollowUpUpdate = z.infer<typeof DonorFollowUpUpdateSchema>;
export type ValidatedDraft = z.infer<typeof ValidatedDraftSchema>;
export type GenerationRecord = z.infer<typeof GenerationRecordSchema>;
export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;
export type CitationValidationResult = z.infer<
  typeof CitationValidationResultSchema
>;
export type GenerationRun = z.infer<typeof GenerationRunSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type ProjectAccessRole = z.infer<typeof ProjectAccessRoleSchema>;
export type User = z.infer<typeof UserSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectMembership = z.infer<typeof ProjectMembershipSchema>;
export type ProjectMembershipWithUser = z.infer<
  typeof ProjectMembershipWithUserSchema
>;
export type DocumentFormat = z.infer<typeof DocumentFormatSchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type DocumentWarning = z.infer<typeof DocumentWarningSchema>;
export type DocumentHeading = z.infer<typeof DocumentHeadingSchema>;
export type DocumentParserMetadata = z.infer<
  typeof DocumentParserMetadataSchema
>;
export type SourceChunkMetadata = z.infer<typeof SourceChunkMetadataSchema>;
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
export type SourceChunk = z.infer<typeof SourceChunkSchema>;
export type DocumentUploadResult = z.infer<typeof DocumentUploadResultSchema>;
export type OpportunityRecord = z.infer<typeof OpportunityRecordSchema>;
export type DraftRecord = z.infer<typeof DraftRecordSchema>;
