import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { Opportunity, ValidatedDraft } from "@/domain";

import { PrismaStorage } from "./prisma";

function readMigrationSql() {
  const migrationsDir = path.join(process.cwd(), "prisma/migrations");
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((migrationName) =>
      readFileSync(
        path.join(migrationsDir, migrationName, "migration.sql"),
        "utf8",
      ),
    )
    .join("\n");
}

const tempDirs: string[] = [];
const prismaClients: PrismaClient[] = [];

function createTestStorage() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "investmentgen-"));
  tempDirs.push(tempDir);
  const databasePath = path.join(tempDir, "test.db");

  const sqlite = new Database(databasePath);
  sqlite.exec(readMigrationSql());
  sqlite.close();

  const adapter = new PrismaBetterSqlite3({ url: databasePath });
  const prisma = new PrismaClient({ adapter });
  prismaClients.push(prisma);

  return new PrismaStorage(prisma);
}

function minimalOpportunity(citationId: string): Opportunity {
  return {
    id: "opportunity-1",
    title: {
      value: "Source-backed program",
      status: "source_provided",
      confidence: "medium",
      citationIds: [citationId],
    },
    summary: {
      value: "A source-backed program can be reviewed as a candidate concept.",
      status: "source_provided",
      confidence: "medium",
      citationIds: [citationId],
    },
    problemStatement: {
      status: "unresolved",
      confidence: "low",
      citationIds: [],
    },
    proposedIntervention: {
      status: "unresolved",
      confidence: "low",
      citationIds: [],
    },
    whyNow: {
      status: "unresolved",
      confidence: "low",
      citationIds: [],
    },
    investorRelevance: {
      status: "unresolved",
      confidence: "low",
      citationIds: [],
    },
    expectedOutcomes: [],
    longTermImpact: [],
    geographies: [],
    organizationRoles: [],
    fundingPathways: [
      {
        id: "pathway-1",
        pathwayType: "unresolved_pathway",
        status: "unresolved",
        confidence: "low",
        citationIds: [],
      },
    ],
    beneficiaryPopulations: [],
    claims: [
      {
        id: "claim-1",
        statement:
          "A source-backed program can be reviewed as a candidate concept.",
        kind: "factual",
        status: "source_provided",
        validationStatus: "supported",
        citationIds: [citationId],
        derivedFromClaimIds: [],
      },
    ],
    risks: [],
    evidenceGaps: [
      {
        id: "gap-1",
        fieldKey: "funding_pathway",
        description: "Funding pathway is unresolved.",
        severity: "medium",
      },
    ],
    overallStatus: "source_provided",
  };
}

afterEach(async () => {
  await Promise.all(
    prismaClients.splice(0).map((client) => client.$disconnect()),
  );

  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("PrismaStorage", () => {
  it("scopes projects by membership and persists login sessions", async () => {
    const storage = createTestStorage();
    const admin = await storage.createUser({
      id: "user-admin",
      email: "admin@example.com",
      name: "Admin User",
      passwordHash: "hash-admin",
      systemRole: "admin",
    });
    const analyst = await storage.createUser({
      id: "user-analyst",
      email: "analyst@example.com",
      name: "Analyst User",
      passwordHash: "hash-analyst",
      systemRole: "member",
    });
    const project = await storage.createProject({
      name: "Member-scoped project",
      ownerUserId: admin.id,
    });

    expect(await storage.listProjects(admin.id)).toHaveLength(1);
    expect(await storage.listProjects(analyst.id)).toHaveLength(0);
    expect(
      await storage.getProjectMembership(project.id, admin.id),
    ).toMatchObject({
      role: "owner",
      user: {
        email: "admin@example.com",
      },
    });

    await storage.upsertProjectMembership({
      projectId: project.id,
      userId: analyst.id,
      role: "viewer",
    });

    expect(await storage.listProjects(analyst.id)).toHaveLength(1);
    expect(await storage.listProjectMemberships(project.id)).toHaveLength(2);

    const session = await storage.createAuthSession({
      id: "session-1",
      userId: analyst.id,
      tokenHash: "token-hash",
      expiresAt: new Date("2026-07-22T00:00:00.000Z"),
    });

    expect(session.user.email).toBe("analyst@example.com");
    expect(await storage.getAuthSessionByTokenHash("token-hash")).toMatchObject(
      {
        user: {
          id: analyst.id,
        },
      },
    );

    await storage.deleteAuthSessionByTokenHash("token-hash");
    expect(await storage.getAuthSessionByTokenHash("token-hash")).toBeNull();
  });

  it("persists projects, source documents, and citation-backed chunks", async () => {
    const storage = createTestStorage();
    const project = await storage.createProject({
      name: "Test project",
      description: "Persistence check",
    });

    const document = await storage.createSourceDocument({
      id: "document-1",
      projectId: project.id,
      filename: "source.txt",
      mimeType: "text/plain",
      fileExtension: "txt",
      sizeBytes: 64,
      storagePath: "data/uploads/source.txt",
      parserType: "txt",
    });

    await storage.replaceSourceChunks(document.id, [
      {
        id: "chunk-1",
        sourceDocumentId: document.id,
        chunkIndex: 0,
        text: "Evidence-backed source text.",
        charStart: 0,
        charEnd: 28,
        citation: {
          id: "citation-1",
          sourceDocumentId: document.id,
          filename: document.filename,
          chunkId: "chunk-1",
          excerpt: "Evidence-backed source text.",
        },
        metadata: {
          sectionHeading: "Program Evidence",
          wordCount: 3,
        },
      },
    ]);

    await storage.updateSourceDocument(document.id, {
      status: "parsed",
      characterCount: 28,
      textHash: "hash",
      parserMetadata: {
        parserName: "txt",
        wordCount: 3,
        characterCount: 28,
        headings: [
          {
            text: "Program Evidence",
          },
        ],
      },
    });

    await storage.replaceOpportunityRecords(project.id, [
      {
        id: "opportunity-record-1",
        projectId: project.id,
        title: "Source-backed program",
        overallStatus: "source_provided",
        opportunity: minimalOpportunity("citation-1"),
        sourceDocumentIds: [document.id],
      },
    ]);
    const draft: ValidatedDraft = {
      id: "draft-1",
      opportunityId: "opportunity-1",
      outputType: "executive_investment_case",
      investorSegment: "general_donor",
      audienceTailoring: {
        familiarity: "new_to_topic",
        scale: "exploratory",
        tone: "balanced",
      },
      prospectusBuilder: {
        narrativeAngle: "catalytic_philanthropy",
      },
      title: "Source-backed program",
      sectionOrder: ["investment_proposition"],
      sections: [
        {
          id: "section-1",
          sectionKey: "investment_proposition",
          title: "Investment Proposition",
          renderedMarkdown: "A source-backed program can be reviewed.",
          claimIds: ["claim-1"],
          evidenceGapIds: [],
          warningText: [],
          orderIndex: 0,
          regenerationCount: 0,
        },
      ],
      claims: [
        {
          id: "claim-1",
          statement: "A source-backed program can be reviewed.",
          kind: "factual",
          status: "source_provided",
          validationStatus: "supported",
          citationIds: ["citation-1"],
          derivedFromClaimIds: [],
        },
      ],
      citations: [
        {
          id: "citation-1",
          sourceDocumentId: document.id,
          filename: document.filename,
          chunkId: "chunk-1",
          excerpt: "Evidence-backed source text.",
        },
      ],
      evidenceGaps: [],
      narrativeChanges: [],
      followUpUpdates: [],
      generatedAtIso: "2026-07-15T00:00:00.000Z",
      draftNotice: "Draft for human review",
    };

    await storage.createDraftRecord({
      id: draft.id,
      projectId: project.id,
      opportunityRecordId: "opportunity-record-1",
      opportunityId: draft.opportunityId,
      outputType: draft.outputType,
      investorSegment: draft.investorSegment,
      draft,
    });

    expect(await storage.listProjects()).toHaveLength(1);
    expect(await storage.listSourceDocuments(project.id)).toMatchObject([
      {
        filename: "source.txt",
        status: "parsed",
        characterCount: 28,
        parserMetadata: {
          parserName: "txt",
          wordCount: 3,
        },
      },
    ]);
    expect(await storage.listSourceChunks(document.id)).toMatchObject([
      {
        text: "Evidence-backed source text.",
        citation: {
          id: "citation-1",
          sourceDocumentId: document.id,
        },
        metadata: {
          sectionHeading: "Program Evidence",
        },
      },
    ]);
    expect(await storage.listOpportunityRecords(project.id)).toMatchObject([
      {
        title: "Source-backed program",
        opportunity: {
          id: "opportunity-1",
        },
        sourceDocumentIds: [document.id],
      },
    ]);
    expect(await storage.listDraftRecords(project.id)).toMatchObject([
      {
        id: "draft-1",
        outputType: "executive_investment_case",
        investorSegment: "general_donor",
        draft: {
          title: "Source-backed program",
        },
      },
    ]);
  });
});
