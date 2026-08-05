-- AlterTable
ALTER TABLE "SourceDocument" ADD COLUMN "parserMetadataJson" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "SourceChunk" ADD COLUMN "metadataJson" TEXT NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "OpportunityRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "opportunityJson" TEXT NOT NULL,
    "sourceDocumentIdsJson" TEXT NOT NULL DEFAULT '[]',
    "extractionRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpportunityRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OpportunityRecord_projectId_idx" ON "OpportunityRecord"("projectId");

-- CreateIndex
CREATE INDEX "OpportunityRecord_overallStatus_idx" ON "OpportunityRecord"("overallStatus");
