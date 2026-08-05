-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "parserType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "textHash" TEXT,
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDocumentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "citationJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceChunk_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "runType" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "storedPayloadMode" TEXT NOT NULL,
    "redactedResponseJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "SourceDocument_projectId_idx" ON "SourceDocument"("projectId");

-- CreateIndex
CREATE INDEX "SourceDocument_status_idx" ON "SourceDocument"("status");

-- CreateIndex
CREATE INDEX "SourceChunk_sourceDocumentId_idx" ON "SourceChunk"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceChunk_sourceDocumentId_chunkIndex_key" ON "SourceChunk"("sourceDocumentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "GenerationRecord_projectId_idx" ON "GenerationRecord"("projectId");

-- CreateIndex
CREATE INDEX "GenerationRecord_opportunityId_idx" ON "GenerationRecord"("opportunityId");

-- CreateIndex
CREATE INDEX "GenerationRecord_runType_idx" ON "GenerationRecord"("runType");
