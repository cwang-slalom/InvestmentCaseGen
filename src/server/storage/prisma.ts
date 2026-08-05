import { randomUUID } from "node:crypto";

import {
  DocumentStatus as PrismaDocumentStatus,
  ProjectAccessRole as PrismaProjectAccessRole,
  PrismaClient,
  SystemRole as PrismaSystemRole,
} from "@/generated/prisma/client";
import { z } from "zod";

import {
  DocumentParserMetadataSchema,
  DocumentWarningSchema,
  CitationValidationResultSchema,
  DraftRecordSchema,
  GenerationRunSchema,
  OpportunityRecordSchema,
  OpportunityAssessmentSchema,
  OpportunitySchema,
  ProjectMembershipWithUserSchema,
  ProjectSchema,
  SourceChunkMetadataSchema,
  SourceChunkSchema,
  SourceDocumentSchema,
  UserSchema,
  ValidatedDraftSchema,
} from "@/domain";

import { getPrismaClient } from "./prisma-client";
import type {
  CreateAuthSessionInput,
  CreateDraftRecordInput,
  CreateProjectInput,
  CreateGenerationRunInput,
  CreateSourceChunkInput,
  CreateSourceDocumentInput,
  CreateUserInput,
  Storage,
  UpdateDraftRecordInput,
  UpdateOpportunityRecordInput,
  UpdateSourceDocumentInput,
  UpsertProjectMembershipInput,
  UpsertOpportunityRecordInput,
} from "./types";

type PrismaUser = Awaited<ReturnType<PrismaClient["user"]["findFirst"]>>;
type PrismaProjectMembership = Awaited<
  ReturnType<PrismaClient["projectMembership"]["findFirst"]>
>;
type PrismaProject = Awaited<ReturnType<PrismaClient["project"]["findFirst"]>>;
type PrismaSourceDocument = Awaited<
  ReturnType<PrismaClient["sourceDocument"]["findFirst"]>
>;
type PrismaSourceChunk = Awaited<
  ReturnType<PrismaClient["sourceChunk"]["findFirst"]>
>;
type PrismaOpportunityRecord = Awaited<
  ReturnType<PrismaClient["opportunityRecord"]["findFirst"]>
>;
type PrismaGenerationRun = Awaited<
  ReturnType<PrismaClient["generationRun"]["findFirst"]>
>;
type PrismaDraftRecord = Awaited<
  ReturnType<PrismaClient["draftRecord"]["findFirst"]>
>;

const DocumentWarningListSchema = DocumentWarningSchema.array();
const SourceDocumentIdsSchema = z.array(z.string());
const ReviewMetadataSchema = z.object({
  humanReviewedFields: z.array(z.string()).default([]),
  lastReviewedAtIso: z.string().optional(),
});

function parseWarnings(warningsJson: string) {
  try {
    return DocumentWarningListSchema.parse(JSON.parse(warningsJson));
  } catch {
    return [];
  }
}

function serializeWarnings(warnings: UpdateSourceDocumentInput["warnings"]) {
  return warnings ? JSON.stringify(warnings) : undefined;
}

function parseParserMetadata(parserMetadataJson: string) {
  try {
    return DocumentParserMetadataSchema.parse(JSON.parse(parserMetadataJson));
  } catch {
    return undefined;
  }
}

function serializeParserMetadata(
  parserMetadata: UpdateSourceDocumentInput["parserMetadata"],
) {
  return parserMetadata ? JSON.stringify(parserMetadata) : undefined;
}

function serializeCitation(citation: CreateSourceChunkInput["citation"]) {
  return JSON.stringify(citation);
}

function parseCitation(citationJson: string) {
  return JSON.parse(citationJson);
}

function serializeChunkMetadata(metadata: CreateSourceChunkInput["metadata"]) {
  return JSON.stringify(metadata);
}

function parseChunkMetadata(metadataJson: string) {
  try {
    return SourceChunkMetadataSchema.parse(JSON.parse(metadataJson));
  } catch {
    return { wordCount: 0 };
  }
}

function parseOpportunity(opportunityJson: string) {
  return OpportunitySchema.parse(JSON.parse(opportunityJson));
}

function parseAssessment(assessmentJson: string | null) {
  if (!assessmentJson) {
    return undefined;
  }

  return OpportunityAssessmentSchema.parse(JSON.parse(assessmentJson));
}

function parseValidation(validationJson: string | null) {
  if (!validationJson) {
    return undefined;
  }

  return CitationValidationResultSchema.parse(JSON.parse(validationJson));
}

function parseReviewMetadata(reviewMetadataJson: string | null) {
  if (!reviewMetadataJson) {
    return undefined;
  }

  return ReviewMetadataSchema.parse(JSON.parse(reviewMetadataJson));
}

function parseDraft(draftJson: string) {
  return ValidatedDraftSchema.parse(JSON.parse(draftJson));
}

function parseSourceDocumentIds(sourceDocumentIdsJson: string) {
  try {
    return SourceDocumentIdsSchema.parse(JSON.parse(sourceDocumentIdsJson));
  } catch {
    return [];
  }
}

function toDomainStatus(status: PrismaDocumentStatus) {
  switch (status) {
    case PrismaDocumentStatus.UPLOADED:
      return "uploaded";
    case PrismaDocumentStatus.PARSED:
      return "parsed";
    case PrismaDocumentStatus.FAILED:
      return "failed";
    case PrismaDocumentStatus.REJECTED:
      return "rejected";
  }
}

function toPrismaStatus(status: UpdateSourceDocumentInput["status"]) {
  switch (status) {
    case "uploaded":
      return PrismaDocumentStatus.UPLOADED;
    case "parsed":
      return PrismaDocumentStatus.PARSED;
    case "failed":
      return PrismaDocumentStatus.FAILED;
    case "rejected":
      return PrismaDocumentStatus.REJECTED;
    case undefined:
      return undefined;
  }
}

function toDomainSystemRole(role: PrismaSystemRole) {
  switch (role) {
    case PrismaSystemRole.ADMIN:
      return "admin";
    case PrismaSystemRole.MEMBER:
      return "member";
  }
}

function toPrismaSystemRole(role: CreateUserInput["systemRole"]) {
  switch (role) {
    case "admin":
      return PrismaSystemRole.ADMIN;
    case "member":
      return PrismaSystemRole.MEMBER;
    case undefined:
      return undefined;
  }
}

function toDomainProjectAccessRole(role: PrismaProjectAccessRole) {
  switch (role) {
    case PrismaProjectAccessRole.OWNER:
      return "owner";
    case PrismaProjectAccessRole.EDITOR:
      return "editor";
    case PrismaProjectAccessRole.VIEWER:
      return "viewer";
  }
}

function toPrismaProjectAccessRole(role: UpsertProjectMembershipInput["role"]) {
  switch (role) {
    case "owner":
      return PrismaProjectAccessRole.OWNER;
    case "editor":
      return PrismaProjectAccessRole.EDITOR;
    case "viewer":
      return PrismaProjectAccessRole.VIEWER;
  }
}

function userToDomain(user: NonNullable<PrismaUser>) {
  return UserSchema.parse({
    id: user.id,
    email: user.email,
    name: user.name,
    systemRole: toDomainSystemRole(user.systemRole),
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

function userWithPasswordHashToDomain(user: NonNullable<PrismaUser>) {
  return {
    ...userToDomain(user),
    passwordHash: user.passwordHash,
  };
}

function membershipWithUserToDomain(
  membership: NonNullable<PrismaProjectMembership> & {
    user: NonNullable<PrismaUser>;
  },
) {
  return ProjectMembershipWithUserSchema.parse({
    id: membership.id,
    projectId: membership.projectId,
    userId: membership.userId,
    role: toDomainProjectAccessRole(membership.role),
    createdAt: membership.createdAt,
    user: userToDomain(membership.user),
  });
}

function authSessionWithUserToDomain(session: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  user: NonNullable<PrismaUser>;
}) {
  return {
    id: session.id,
    userId: session.userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    user: userToDomain(session.user),
  };
}

function projectToDomain(project: NonNullable<PrismaProject>) {
  return ProjectSchema.parse({
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}

function documentToDomain(document: NonNullable<PrismaSourceDocument>) {
  return SourceDocumentSchema.parse({
    id: document.id,
    projectId: document.projectId,
    filename: document.filename,
    mimeType: document.mimeType,
    fileExtension: document.fileExtension,
    sizeBytes: document.sizeBytes,
    storagePath: document.storagePath,
    parserType: document.parserType,
    status: toDomainStatus(document.status),
    warnings: parseWarnings(document.warningsJson),
    parserMetadata: parseParserMetadata(document.parserMetadataJson),
    errorMessage: document.errorMessage ?? undefined,
    textHash: document.textHash ?? undefined,
    characterCount: document.characterCount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  });
}

function chunkToDomain(chunk: NonNullable<PrismaSourceChunk>) {
  return SourceChunkSchema.parse({
    id: chunk.id,
    sourceDocumentId: chunk.sourceDocumentId,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    citation: parseCitation(chunk.citationJson),
    metadata: parseChunkMetadata(chunk.metadataJson),
    createdAt: chunk.createdAt,
  });
}

function opportunityRecordToDomain(
  record: NonNullable<PrismaOpportunityRecord>,
) {
  const opportunity = parseOpportunity(record.opportunityJson);

  return OpportunityRecordSchema.parse({
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    overallStatus: record.overallStatus,
    opportunity,
    assessment: parseAssessment(record.assessmentJson),
    validation: parseValidation(record.validationJson),
    reviewMetadata: parseReviewMetadata(record.reviewMetadataJson),
    sourceDocumentIds: parseSourceDocumentIds(record.sourceDocumentIdsJson),
    extractionRunId: record.extractionRunId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function generationRunToDomain(record: NonNullable<PrismaGenerationRun>) {
  return GenerationRunSchema.parse({
    id: record.id,
    projectId: record.projectId ?? undefined,
    opportunityId: record.opportunityId ?? undefined,
    runType: record.runType,
    promptName: record.promptName,
    promptVersion: record.promptVersion,
    modelProvider: record.modelProvider,
    modelName: record.modelName,
    inputChunkIds: parseSourceDocumentIds(record.inputChunkIdsJson),
    validationResult: parseValidation(record.validationResultJson),
    status: record.status,
    storedPayloadMode: record.storedPayloadMode,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function draftRecordToDomain(record: NonNullable<PrismaDraftRecord>) {
  return DraftRecordSchema.parse({
    id: record.id,
    projectId: record.projectId,
    opportunityRecordId: record.opportunityRecordId,
    opportunityId: record.opportunityId,
    outputType: record.outputType,
    investorSegment: record.investorSegment,
    draft: parseDraft(record.draftJson),
    generationRunId: record.generationRunId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export class PrismaStorage implements Storage {
  constructor(private readonly prisma = getPrismaClient()) {}

  async createUser(input: CreateUserInput) {
    const user = await this.prisma.user.create({
      data: {
        id: input.id,
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        passwordHash: input.passwordHash,
        systemRole: toPrismaSystemRole(input.systemRole),
        active: input.active ?? true,
      },
    });

    return userToDomain(user);
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return user ? userToDomain(user) : null;
  }

  async getUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    return user ? userToDomain(user) : null;
  }

  async getUserForAuthByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    return user ? userWithPasswordHashToDomain(user) : null;
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });

    return users.map(userToDomain);
  }

  async createAuthSession(input: CreateAuthSessionInput) {
    const session = await this.prisma.authSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      include: { user: true },
    });

    return authSessionWithUserToDomain(session);
  }

  async getAuthSessionByTokenHash(tokenHash: string) {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    return session ? authSessionWithUserToDomain(session) : null;
  }

  async deleteAuthSessionByTokenHash(tokenHash: string) {
    await this.prisma.authSession.deleteMany({
      where: { tokenHash },
    });
  }

  async deleteExpiredAuthSessions(now = new Date()) {
    const result = await this.prisma.authSession.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    return result.count;
  }

  async getProjectMembership(projectId: string, userId: string) {
    const membership = await this.prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      include: { user: true },
    });

    return membership ? membershipWithUserToDomain(membership) : null;
  }

  async listProjectMemberships(projectId: string) {
    const memberships = await this.prisma.projectMembership.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return memberships.map(membershipWithUserToDomain);
  }

  async upsertProjectMembership(input: UpsertProjectMembershipInput) {
    const membership = await this.prisma.projectMembership.upsert({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: input.userId,
        },
      },
      update: {
        role: toPrismaProjectAccessRole(input.role),
      },
      create: {
        id: randomUUID(),
        projectId: input.projectId,
        userId: input.userId,
        role: toPrismaProjectAccessRole(input.role),
      },
      include: { user: true },
    });

    return membershipWithUserToDomain(membership);
  }

  async createProject(input: CreateProjectInput) {
    const projectId = randomUUID();
    const project = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.project.create({
        data: {
          id: projectId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
        },
      });

      if (input.ownerUserId) {
        await transaction.projectMembership.create({
          data: {
            id: randomUUID(),
            projectId: created.id,
            userId: input.ownerUserId,
            role: PrismaProjectAccessRole.OWNER,
          },
        });
      }

      return created;
    });

    return projectToDomain(project);
  }

  async getProject(projectId: string, userId?: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...(userId
          ? {
              memberships: {
                some: { userId },
              },
            }
          : {}),
      },
    });

    return project ? projectToDomain(project) : null;
  }

  async listProjects(userId?: string) {
    const projects = await this.prisma.project.findMany({
      where: userId
        ? {
            memberships: {
              some: { userId },
            },
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
    });

    return projects.map(projectToDomain);
  }

  async createSourceDocument(input: CreateSourceDocumentInput) {
    const document = await this.prisma.sourceDocument.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        fileExtension: input.fileExtension,
        sizeBytes: input.sizeBytes,
        storagePath: input.storagePath,
        parserType: input.parserType,
        status: PrismaDocumentStatus.UPLOADED,
      },
    });

    return documentToDomain(document);
  }

  async updateSourceDocument(
    documentId: string,
    input: UpdateSourceDocumentInput,
  ) {
    const document = await this.prisma.sourceDocument.update({
      where: { id: documentId },
      data: {
        status: toPrismaStatus(input.status),
        warningsJson: serializeWarnings(input.warnings),
        parserMetadataJson: serializeParserMetadata(input.parserMetadata),
        errorMessage: input.errorMessage,
        textHash: input.textHash,
        characterCount: input.characterCount,
      },
    });

    return documentToDomain(document);
  }

  async getSourceDocument(documentId: string) {
    const document = await this.prisma.sourceDocument.findUnique({
      where: { id: documentId },
    });

    return document ? documentToDomain(document) : null;
  }

  async listSourceDocuments(projectId: string) {
    const documents = await this.prisma.sourceDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return documents.map(documentToDomain);
  }

  async replaceSourceChunks(
    documentId: string,
    chunks: CreateSourceChunkInput[],
  ) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.sourceChunk.deleteMany({
        where: { sourceDocumentId: documentId },
      });

      if (chunks.length > 0) {
        await transaction.sourceChunk.createMany({
          data: chunks.map((chunk) => ({
            id: chunk.id,
            sourceDocumentId: chunk.sourceDocumentId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            charStart: chunk.charStart,
            charEnd: chunk.charEnd,
            citationJson: serializeCitation(chunk.citation),
            metadataJson: serializeChunkMetadata(chunk.metadata),
          })),
        });
      }
    });

    return this.listSourceChunks(documentId);
  }

  async listSourceChunks(documentId: string) {
    const chunks = await this.prisma.sourceChunk.findMany({
      where: { sourceDocumentId: documentId },
      orderBy: { chunkIndex: "asc" },
    });

    return chunks.map(chunkToDomain);
  }

  async replaceOpportunityRecords(
    projectId: string,
    opportunities: UpsertOpportunityRecordInput[],
  ) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.opportunityRecord.deleteMany({
        where: { projectId },
      });

      if (opportunities.length > 0) {
        await transaction.opportunityRecord.createMany({
          data: opportunities.map((record) => ({
            id: record.id,
            projectId: record.projectId,
            title: record.title,
            overallStatus: record.overallStatus,
            opportunityJson: JSON.stringify(record.opportunity),
            assessmentJson: record.assessment
              ? JSON.stringify(record.assessment)
              : null,
            validationJson: record.validation
              ? JSON.stringify(record.validation)
              : null,
            reviewMetadataJson: record.reviewMetadata
              ? JSON.stringify(record.reviewMetadata)
              : null,
            sourceDocumentIdsJson: JSON.stringify(record.sourceDocumentIds),
            extractionRunId: record.extractionRunId,
          })),
        });
      }
    });

    return this.listOpportunityRecords(projectId);
  }

  async getOpportunityRecord(projectId: string, opportunityId: string) {
    const record = await this.prisma.opportunityRecord.findFirst({
      where: {
        id: opportunityId,
        projectId,
      },
    });

    return record ? opportunityRecordToDomain(record) : null;
  }

  async updateOpportunityRecord(
    projectId: string,
    opportunityId: string,
    input: UpdateOpportunityRecordInput,
  ) {
    const record = await this.prisma.opportunityRecord.update({
      where: {
        id: opportunityId,
      },
      data: {
        title: input.title,
        overallStatus: input.overallStatus,
        opportunityJson: input.opportunity
          ? JSON.stringify(input.opportunity)
          : undefined,
        assessmentJson:
          input.assessment === undefined
            ? undefined
            : JSON.stringify(input.assessment),
        validationJson:
          input.validation === undefined
            ? undefined
            : JSON.stringify(input.validation),
        reviewMetadataJson:
          input.reviewMetadata === undefined
            ? undefined
            : JSON.stringify(input.reviewMetadata),
      },
    });

    if (record.projectId !== projectId) {
      throw new Error("Opportunity does not belong to the requested project.");
    }

    return opportunityRecordToDomain(record);
  }

  async listOpportunityRecords(projectId: string) {
    const records = await this.prisma.opportunityRecord.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return records.map(opportunityRecordToDomain);
  }

  async createGenerationRun(input: CreateGenerationRunInput) {
    const record = await this.prisma.generationRun.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        opportunityId: input.opportunityId,
        runType: input.runType,
        promptName: input.promptName,
        promptVersion: input.promptVersion,
        modelProvider: input.modelProvider,
        modelName: input.modelName,
        inputChunkIdsJson: JSON.stringify(input.inputChunkIds),
        validationResultJson: input.validationResult
          ? JSON.stringify(input.validationResult)
          : null,
        status: input.status,
        storedPayloadMode: input.storedPayloadMode,
      },
    });

    return generationRunToDomain(record);
  }

  async listGenerationRuns(projectId: string) {
    const records = await this.prisma.generationRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return records.map(generationRunToDomain);
  }

  async createDraftRecord(input: CreateDraftRecordInput) {
    const record = await this.prisma.draftRecord.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        opportunityRecordId: input.opportunityRecordId,
        opportunityId: input.opportunityId,
        outputType: input.outputType,
        investorSegment: input.investorSegment,
        draftJson: JSON.stringify(input.draft),
        generationRunId: input.generationRunId,
      },
    });

    return draftRecordToDomain(record);
  }

  async getDraftRecord(projectId: string, draftId: string) {
    const record = await this.prisma.draftRecord.findFirst({
      where: {
        id: draftId,
        projectId,
      },
    });

    return record ? draftRecordToDomain(record) : null;
  }

  async updateDraftRecord(
    projectId: string,
    draftId: string,
    input: UpdateDraftRecordInput,
  ) {
    const record = await this.prisma.draftRecord.update({
      where: {
        id: draftId,
      },
      data: {
        draftJson: input.draft ? JSON.stringify(input.draft) : undefined,
        investorSegment: input.investorSegment,
        generationRunId: input.generationRunId,
      },
    });

    if (record.projectId !== projectId) {
      throw new Error("Draft does not belong to the requested project.");
    }

    return draftRecordToDomain(record);
  }

  async listDraftRecords(projectId: string, opportunityRecordId?: string) {
    const records = await this.prisma.draftRecord.findMany({
      where: {
        projectId,
        opportunityRecordId,
      },
      orderBy: { updatedAt: "desc" },
    });

    return records.map(draftRecordToDomain);
  }
}

export function getStorage(): Storage {
  return new PrismaStorage();
}
