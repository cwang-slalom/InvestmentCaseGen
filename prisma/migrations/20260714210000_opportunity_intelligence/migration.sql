-- AlterTable
ALTER TABLE "OpportunityRecord" ADD COLUMN "assessmentJson" TEXT;

-- AlterTable
ALTER TABLE "OpportunityRecord" ADD COLUMN "validationJson" TEXT;

-- AlterTable
ALTER TABLE "OpportunityRecord" ADD COLUMN "reviewMetadataJson" TEXT;

-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "runType" TEXT NOT NULL,
    "promptName" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "inputChunkIdsJson" TEXT NOT NULL DEFAULT '[]',
    "validationResultJson" TEXT,
    "status" TEXT NOT NULL,
    "storedPayloadMode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "GenerationRun_projectId_idx" ON "GenerationRun"("projectId");

-- CreateIndex
CREATE INDEX "GenerationRun_opportunityId_idx" ON "GenerationRun"("opportunityId");

-- CreateIndex
CREATE INDEX "GenerationRun_runType_idx" ON "GenerationRun"("runType");
