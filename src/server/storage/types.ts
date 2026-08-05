import type {
  Citation,
  CitationValidationResult,
  DocumentParserMetadata,
  DocumentFormat,
  DocumentStatus,
  DocumentWarning,
  DraftRecord,
  GenerationRun,
  InvestorSegment,
  Opportunity,
  OpportunityAssessment,
  OpportunityRecord,
  OutputType,
  ProjectAccessRole,
  ProjectMembershipWithUser,
  Project,
  SourceChunk,
  SourceChunkMetadata,
  SourceDocument,
  User,
  UserRole,
  ValidatedDraft,
} from "@/domain";

export type CreateProjectInput = {
  name: string;
  description?: string;
  ownerUserId?: string;
};

export type CreateUserInput = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  systemRole?: UserRole;
  active?: boolean;
};

export type UserWithPasswordHash = User & {
  passwordHash: string;
};

export type AuthSessionWithUser = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  user: User;
};

export type CreateAuthSessionInput = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type UpsertProjectMembershipInput = {
  projectId: string;
  userId: string;
  role: ProjectAccessRole;
};

export type CreateSourceDocumentInput = {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  fileExtension: DocumentFormat;
  sizeBytes: number;
  storagePath: string;
  parserType: DocumentFormat;
};

export type UpdateSourceDocumentInput = {
  status?: DocumentStatus;
  warnings?: DocumentWarning[];
  parserMetadata?: DocumentParserMetadata;
  errorMessage?: string;
  textHash?: string;
  characterCount?: number;
};

export type CreateSourceChunkInput = {
  id: string;
  sourceDocumentId: string;
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
  citation: Citation;
  metadata: SourceChunkMetadata;
};

export type UpsertOpportunityRecordInput = {
  id: string;
  projectId: string;
  title: string;
  overallStatus: Opportunity["overallStatus"];
  opportunity: Opportunity;
  assessment?: OpportunityAssessment;
  validation?: CitationValidationResult;
  reviewMetadata?: {
    humanReviewedFields: string[];
    lastReviewedAtIso?: string;
  };
  sourceDocumentIds: string[];
  extractionRunId?: string;
};

export type UpdateOpportunityRecordInput = {
  title?: string;
  overallStatus?: Opportunity["overallStatus"];
  opportunity?: Opportunity;
  assessment?: OpportunityAssessment;
  validation?: CitationValidationResult;
  reviewMetadata?: {
    humanReviewedFields: string[];
    lastReviewedAtIso?: string;
  };
};

export type CreateGenerationRunInput = {
  id: string;
  projectId?: string;
  opportunityId?: string;
  runType: GenerationRun["runType"];
  promptName: string;
  promptVersion: string;
  modelProvider: string;
  modelName: string;
  inputChunkIds: string[];
  validationResult?: CitationValidationResult;
  status: GenerationRun["status"];
  storedPayloadMode: GenerationRun["storedPayloadMode"];
};

export type CreateDraftRecordInput = {
  id: string;
  projectId: string;
  opportunityRecordId: string;
  opportunityId: string;
  outputType: OutputType;
  investorSegment: InvestorSegment;
  draft: ValidatedDraft;
  generationRunId?: string;
};

export type UpdateDraftRecordInput = {
  draft?: ValidatedDraft;
  investorSegment?: InvestorSegment;
  generationRunId?: string;
};

export interface Storage {
  createUser(input: CreateUserInput): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserForAuthByEmail(email: string): Promise<UserWithPasswordHash | null>;
  listUsers(): Promise<User[]>;
  createAuthSession(
    input: CreateAuthSessionInput,
  ): Promise<AuthSessionWithUser>;
  getAuthSessionByTokenHash(
    tokenHash: string,
  ): Promise<AuthSessionWithUser | null>;
  deleteAuthSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteExpiredAuthSessions(now?: Date): Promise<number>;
  getProjectMembership(
    projectId: string,
    userId: string,
  ): Promise<ProjectMembershipWithUser | null>;
  listProjectMemberships(
    projectId: string,
  ): Promise<ProjectMembershipWithUser[]>;
  upsertProjectMembership(
    input: UpsertProjectMembershipInput,
  ): Promise<ProjectMembershipWithUser>;
  createProject(input: CreateProjectInput): Promise<Project>;
  getProject(projectId: string, userId?: string): Promise<Project | null>;
  listProjects(userId?: string): Promise<Project[]>;
  createSourceDocument(
    input: CreateSourceDocumentInput,
  ): Promise<SourceDocument>;
  updateSourceDocument(
    documentId: string,
    input: UpdateSourceDocumentInput,
  ): Promise<SourceDocument>;
  getSourceDocument(documentId: string): Promise<SourceDocument | null>;
  listSourceDocuments(projectId: string): Promise<SourceDocument[]>;
  replaceSourceChunks(
    documentId: string,
    chunks: CreateSourceChunkInput[],
  ): Promise<SourceChunk[]>;
  listSourceChunks(documentId: string): Promise<SourceChunk[]>;
  replaceOpportunityRecords(
    projectId: string,
    opportunities: UpsertOpportunityRecordInput[],
  ): Promise<OpportunityRecord[]>;
  getOpportunityRecord(
    projectId: string,
    opportunityId: string,
  ): Promise<OpportunityRecord | null>;
  updateOpportunityRecord(
    projectId: string,
    opportunityId: string,
    input: UpdateOpportunityRecordInput,
  ): Promise<OpportunityRecord>;
  listOpportunityRecords(projectId: string): Promise<OpportunityRecord[]>;
  createGenerationRun(input: CreateGenerationRunInput): Promise<GenerationRun>;
  listGenerationRuns(projectId: string): Promise<GenerationRun[]>;
  createDraftRecord(input: CreateDraftRecordInput): Promise<DraftRecord>;
  getDraftRecord(
    projectId: string,
    draftId: string,
  ): Promise<DraftRecord | null>;
  updateDraftRecord(
    projectId: string,
    draftId: string,
    input: UpdateDraftRecordInput,
  ): Promise<DraftRecord>;
  listDraftRecords(
    projectId: string,
    opportunityRecordId?: string,
  ): Promise<DraftRecord[]>;
}
