CREATE TABLE "DraftRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "opportunityRecordId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "outputType" TEXT NOT NULL,
  "investorSegment" TEXT NOT NULL,
  "draftJson" TEXT NOT NULL,
  "generationRunId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DraftRecord_projectId_idx" ON "DraftRecord"("projectId");
CREATE INDEX "DraftRecord_opportunityRecordId_idx" ON "DraftRecord"("opportunityRecordId");
CREATE INDEX "DraftRecord_opportunityId_idx" ON "DraftRecord"("opportunityId");
CREATE INDEX "DraftRecord_outputType_idx" ON "DraftRecord"("outputType");
