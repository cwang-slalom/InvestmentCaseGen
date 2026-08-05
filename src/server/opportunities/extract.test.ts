import { describe, expect, it } from "vitest";

import type {
  DraftRecord,
  OpportunityRecord,
  Project,
  SourceChunk,
  SourceDocument,
} from "@/domain";
import type {
  CreateDraftRecordInput,
  CreateGenerationRunInput,
  Storage,
  UpdateDraftRecordInput,
  UpdateOpportunityRecordInput,
  UpsertOpportunityRecordInput,
} from "@/server/storage";

import { extractOpportunitiesForProject } from "./extract";

class MemoryStorage implements Storage {
  opportunities: OpportunityRecord[] = [];
  drafts: DraftRecord[] = [];

  constructor(
    private readonly project: Project,
    private readonly documents: SourceDocument[],
    private readonly chunks: SourceChunk[],
  ) {}

  async createUser(): Promise<never> {
    throw new Error("User storage is not implemented in this test double.");
  }

  async getUser() {
    return null;
  }

  async getUserByEmail() {
    return null;
  }

  async getUserForAuthByEmail() {
    return null;
  }

  async listUsers() {
    return [];
  }

  async createAuthSession(): Promise<never> {
    throw new Error("Auth sessions are not implemented in this test double.");
  }

  async getAuthSessionByTokenHash() {
    return null;
  }

  async deleteAuthSessionByTokenHash() {}

  async deleteExpiredAuthSessions() {
    return 0;
  }

  async getProjectMembership() {
    return null;
  }

  async listProjectMemberships() {
    return [];
  }

  async upsertProjectMembership(): Promise<never> {
    throw new Error("Memberships are not implemented in this test double.");
  }

  async createProject() {
    return this.project;
  }

  async getProject(projectId: string) {
    return this.project.id === projectId ? this.project : null;
  }

  async listProjects() {
    return [this.project];
  }

  async createSourceDocument() {
    return this.documents[0] as SourceDocument;
  }

  async updateSourceDocument() {
    return this.documents[0] as SourceDocument;
  }

  async getSourceDocument(documentId: string) {
    return (
      this.documents.find((document) => document.id === documentId) ?? null
    );
  }

  async listSourceDocuments(projectId: string) {
    return this.documents.filter(
      (document) => document.projectId === projectId,
    );
  }

  async replaceSourceChunks() {
    return this.chunks;
  }

  async listSourceChunks(documentId: string) {
    return this.chunks.filter((chunk) => chunk.sourceDocumentId === documentId);
  }

  async replaceOpportunityRecords(
    projectId: string,
    opportunities: UpsertOpportunityRecordInput[],
  ) {
    this.opportunities = opportunities.map((record) => ({
      id: record.id,
      projectId,
      title: record.title,
      overallStatus: record.overallStatus,
      opportunity: record.opportunity,
      assessment: record.assessment,
      validation: record.validation,
      reviewMetadata: record.reviewMetadata,
      sourceDocumentIds: record.sourceDocumentIds,
      extractionRunId: record.extractionRunId,
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    }));

    return this.opportunities;
  }

  async getOpportunityRecord(projectId: string, opportunityId: string) {
    return (
      this.opportunities.find(
        (record) =>
          record.projectId === projectId && record.id === opportunityId,
      ) ?? null
    );
  }

  async updateOpportunityRecord(
    projectId: string,
    opportunityId: string,
    input: UpdateOpportunityRecordInput,
  ) {
    const existing = await this.getOpportunityRecord(projectId, opportunityId);
    if (!existing) {
      throw new Error("Opportunity not found.");
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    this.opportunities = this.opportunities.map((record) =>
      record.id === opportunityId ? updated : record,
    );

    return updated;
  }

  async listOpportunityRecords(projectId: string) {
    return this.opportunities.filter(
      (record) => record.projectId === projectId,
    );
  }

  async createGenerationRun(input: CreateGenerationRunInput) {
    return {
      ...input,
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    };
  }

  async listGenerationRuns() {
    return [];
  }

  async createDraftRecord(input: CreateDraftRecordInput) {
    const draft = {
      ...input,
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    this.drafts.push(draft);

    return draft;
  }

  async getDraftRecord(projectId: string, draftId: string) {
    return (
      this.drafts.find(
        (draft) => draft.projectId === projectId && draft.id === draftId,
      ) ?? null
    );
  }

  async updateDraftRecord(
    projectId: string,
    draftId: string,
    input: UpdateDraftRecordInput,
  ) {
    const existing = await this.getDraftRecord(projectId, draftId);
    if (!existing) {
      throw new Error("Draft not found.");
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    this.drafts = this.drafts.map((draft) =>
      draft.id === draftId ? updated : draft,
    );

    return updated;
  }

  async listDraftRecords(projectId: string, opportunityRecordId?: string) {
    return this.drafts.filter(
      (draft) =>
        draft.projectId === projectId &&
        (!opportunityRecordId ||
          draft.opportunityRecordId === opportunityRecordId),
    );
  }
}

describe("extractOpportunitiesForProject", () => {
  it("extracts source-grounded candidate opportunities without naming a funding recipient", async () => {
    const project: Project = {
      id: "project-1",
      name: "Project",
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    const document: SourceDocument = {
      id: "document-1",
      projectId: project.id,
      filename: "source.txt",
      mimeType: "text/plain",
      fileExtension: "txt",
      sizeBytes: 500,
      storagePath: "data/uploads/source.txt",
      parserType: "txt",
      status: "parsed",
      warnings: [],
      parserMetadata: {
        parserName: "txt",
        wordCount: 60,
        characterCount: 360,
        headings: [{ text: "Community health worker scale-up" }],
      },
      characterCount: 360,
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    const chunk: SourceChunk = {
      id: "chunk-1",
      sourceDocumentId: document.id,
      chunkIndex: 0,
      text: "Community health worker scale-up. Funding can scale an implementation program for children and improve access to care. The current gap creates risk for families.",
      charStart: 0,
      charEnd: 154,
      citation: {
        id: "citation-1",
        sourceDocumentId: document.id,
        filename: document.filename,
        chunkId: "chunk-1",
        sectionHeading: "Community health worker scale-up",
        excerpt:
          "Funding can scale an implementation program for children and improve access to care.",
      },
      metadata: {
        sectionHeading: "Community health worker scale-up",
        wordCount: 24,
      },
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    const storage = new MemoryStorage(project, [document], [chunk]);

    const opportunities = await extractOpportunitiesForProject({
      projectId: project.id,
      storage,
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.title).toBe("Community health worker scale-up");
    expect(opportunities[0]?.opportunity.fundingPathways).toMatchObject([
      {
        pathwayType: "unresolved_pathway",
        status: "unresolved",
      },
    ]);
    expect(opportunities[0]?.opportunity.evidenceGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: "funding_pathway" }),
      ]),
    );
    expect(opportunities[0]?.opportunity.claims[0]?.citationIds).toContain(
      "citation-1",
    );
  });

  it("keeps only the highest-ranked investment case candidate from one source document", async () => {
    const project: Project = {
      id: "project-1",
      name: "Project",
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    const document: SourceDocument = {
      id: "document-1",
      projectId: project.id,
      filename: "source.txt",
      mimeType: "text/plain",
      fileExtension: "txt",
      sizeBytes: 1200,
      storagePath: "data/uploads/source.txt",
      parserType: "txt",
      status: "parsed",
      warnings: [],
      parserMetadata: {
        parserName: "txt",
        wordCount: 120,
        characterCount: 900,
        headings: [
          { text: "Lower priority pilot" },
          { text: "Integrated primary care scale-up" },
        ],
      },
      characterCount: 900,
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
      updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    const lowerPriorityChunk: SourceChunk = {
      id: "chunk-1",
      sourceDocumentId: document.id,
      chunkIndex: 0,
      text: "Lower priority pilot. Funding can support a research pilot for communities.",
      charStart: 0,
      charEnd: 72,
      citation: {
        id: "citation-1",
        sourceDocumentId: document.id,
        filename: document.filename,
        chunkId: "chunk-1",
        sectionHeading: "Lower priority pilot",
        excerpt: "Funding can support a research pilot for communities.",
      },
      metadata: {
        sectionHeading: "Lower priority pilot",
        wordCount: 10,
      },
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    const strongerChunk: SourceChunk = {
      id: "chunk-2",
      sourceDocumentId: document.id,
      chunkIndex: 1,
      text: "Integrated primary care scale-up. Donor funding and investment can scale an implementation program and intervention for children. The current gap and burden create access risk, while expansion can improve coverage and reduce mortality.",
      charStart: 73,
      charEnd: 297,
      citation: {
        id: "citation-2",
        sourceDocumentId: document.id,
        filename: document.filename,
        chunkId: "chunk-2",
        sectionHeading: "Integrated primary care scale-up",
        excerpt:
          "Donor funding and investment can scale an implementation program and intervention for children.",
      },
      metadata: {
        sectionHeading: "Integrated primary care scale-up",
        wordCount: 31,
      },
      createdAt: new Date("2026-07-14T00:00:00.000Z"),
    };
    const storage = new MemoryStorage(
      project,
      [document],
      [lowerPriorityChunk, strongerChunk],
    );

    const opportunities = await extractOpportunitiesForProject({
      projectId: project.id,
      storage,
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.title).toBe("Integrated primary care scale-up");
    expect(storage.opportunities).toHaveLength(1);
  });
});
