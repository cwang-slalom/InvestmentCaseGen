export type FieldSource =
  | "user"
  | "opportunity"
  | "audience_profile"
  | "ai_suggestion"
  | "system_setup"
  | "extracted_source";

export type CitationRef = {
  sourceId: string;
  label: string;
  locator: string;
  excerpt: string;
};

export type FieldMetadata = {
  source: FieldSource;
  required: boolean;
  editable: boolean;
  confirmed: boolean;
  confidence?: number | null;
  citations?: CitationRef[];
};

export type FieldValue = {
  id: string;
  label: string;
  value: string;
  provenanceLabel: string;
  metadata: FieldMetadata;
};

export type SourceDocument = {
  id: string;
  title: string;
  sourceType: string;
  label: string;
  locator: string;
  excerpt: string;
  status: string;
};

export type Opportunity = {
  id: string;
  title: string;
  programArea: string;
  geography: string;
  summary: string;
  validationStatus: string;
  lastUpdated: string;
  fundingRange: string;
  whyNow: string;
  reach: string;
  primaryOutcomes: string[];
  differentiators: string[];
  sourceList: SourceDocument[];
};

export type AudienceProfile = {
  id: string;
  name: string;
  audienceType: string;
  relationshipStage: string;
  interests: string[];
  geography: string;
  familiarity: string;
  donorPersona: string;
  technicalFamiliarity: string;
  narrativeApproach: string;
  profileUrl: string;
};

export type OutputType =
  | "investment_case"
  | "one_page"
  | "talking_points"
  | "source_appendix";

export type ProjectUpdateType =
  | "meeting_notes"
  | "document_upload"
  | "stakeholder_feedback"
  | "manual_note";

export type ProjectUpdateStatus = "pending_review" | "approved" | "rejected";
export type MemoryItemStatus = "proposed" | "approved" | "deprecated";
export type ArtifactVersionStatus = "current" | "needs_refresh" | "superseded";

export type TaskState = {
  selectedTaskId?: string | null;
  taskLabel?: string | null;
  customDescription?: string | null;
  metadata: Record<string, unknown>;
};

export type OpportunityAudienceState = {
  sourceMode: "existing" | "new";
  opportunityId?: string | null;
  audienceId?: string | null;
  intendedOutcome?: string | null;
  suggestions: FieldValue[];
  selectedOutputs: OutputType[];
  customOpportunityTitle?: string | null;
};

export type ReviewRole = {
  id: string;
  label: string;
  selected: boolean;
  status: string;
  notes: string;
};

export type SourceReadiness = {
  ready: boolean;
  checks: string[];
  blockingIssues: string[];
};

export type ReviewSetupState = {
  approachFields: FieldValue[];
  roles: ReviewRole[];
  confirmed: boolean;
  sourceReadiness: SourceReadiness;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  demoNotice: string;
  task?: TaskState | null;
  opportunityAudience?: OpportunityAudienceState | null;
  extractionId?: string | null;
  reviewSetup?: ReviewSetupState | null;
  generationId?: string | null;
  memorySummary?: ProjectMemorySummary | null;
};

export type ProjectMemorySummary = {
  updateCount: number;
  pendingUpdateCount: number;
  approvedMemoryCount: number;
  needsRefreshCount: number;
};

export type ExtractedField = {
  id: string;
  label: string;
  value: string;
  confidence: number;
  sourceLabel: string;
  locator: string;
  metadata: FieldMetadata;
  verified: boolean;
  locked: boolean;
};

export type ExtractionResult = {
  id: string;
  projectId?: string | null;
  sourceLabel: string;
  temporaryStatus: string;
  confidence: number;
  notes: string;
  fields: ExtractedField[];
};

export type GeneratedSection = {
  id: string;
  type: "narrative" | "metric" | "opportunity" | "team" | "diligence" | "risk" | "engage";
  heading: string;
  body: string;
  citations: CitationRef[];
};

export type GeneratedOutput = {
  id: string;
  type: OutputType;
  title: string;
  status: string;
  sections: GeneratedSection[];
};

export type ExportFormat = "pdf" | "docx" | "pptx" | "markdown" | "txt";

export type UpdateCandidate = {
  id: string;
  category: string;
  label: string;
  value: string;
  confidence: number;
  sourceReference: string;
  citations: CitationRef[];
};

export type AffectedOutput = {
  outputType: OutputType;
  reason: string;
  status: "needs_refresh" | "optional";
};

export type ProjectUpdate = {
  id: string;
  projectId: string;
  updateType: ProjectUpdateType;
  sourceLabel: string;
  rawText: string;
  summary: string;
  status: ProjectUpdateStatus;
  extractedFacts: UpdateCandidate[];
  openQuestions: UpdateCandidate[];
  affectedOutputs: AffectedOutput[];
  createdAt: string;
  approvedAt?: string | null;
};

export type ProjectMemoryItem = {
  id: string;
  projectId: string;
  category: string;
  label: string;
  value: string;
  sourceUpdateId: string;
  sourceReference: string;
  status: MemoryItemStatus;
  citations: CitationRef[];
  createdAt: string;
  approvedAt?: string | null;
};

export type ArtifactVersion = {
  id: string;
  projectId: string;
  outputId: string;
  outputType: OutputType;
  title: string;
  version: number;
  status: ArtifactVersionStatus;
  generationId: string;
  createdFromUpdateId?: string | null;
  createdAt: string;
};

export type ProjectUpdateRefreshResult = {
  update: ProjectUpdate;
  generationId: string;
};

export type ReviewFinding = {
  id: string;
  severity: "blocking" | "warning" | "editorial";
  type: string;
  message: string;
  resolved: boolean;
};

export type InformationNeeded = {
  id: string;
  message: string;
  relatedSection: string;
};

export type GenerationResult = {
  generationId: string;
  projectId: string;
  status: "completed" | "needs_information" | "failed";
  outputs: GeneratedOutput[];
  informationNeeded: InformationNeeded[];
  reviewFindings: ReviewFinding[];
  metadata: Record<string, string>;
};

export type GenerationJobStatus = {
  projectId: string;
  state: "idle" | "running" | "completed" | "failed" | "canceled";
  generationId?: string | null;
  message: string;
  error?: string | null;
  result?: GenerationResult | null;
};

export type AppConfig = {
  appName: string;
  phase: string;
  mode: string;
  demoNotice: string;
  externalWebSearchEnabled: boolean;
  maxUploadMb: number;
  backend: {
    status: string;
    provider: string;
    message: string;
  };
  knowledgeSources: SourceDocument[];
};
