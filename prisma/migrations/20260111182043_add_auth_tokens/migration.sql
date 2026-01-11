-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "projectId" TEXT,
    "sprintId" TEXT,
    "runId" TEXT,
    "lastUsedAt" DATETIME,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "auth_tokens_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs" ("runId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_keyHash_key" ON "auth_tokens"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_runId_key" ON "auth_tokens"("runId");

-- CreateIndex
CREATE INDEX "auth_tokens_keyHash_idx" ON "auth_tokens"("keyHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_idx" ON "auth_tokens"("userId");

-- CreateIndex
CREATE INDEX "auth_tokens_runId_idx" ON "auth_tokens"("runId");
