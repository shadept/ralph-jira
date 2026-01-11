/*
  Warnings:

  - You are about to drop the column `entry` on the `run_logs` table. All the data in the column will be lost.
  - Added the required column `message` to the `run_logs` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_run_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "run_logs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_run_logs" ("createdAt", "id", "runId") SELECT "createdAt", "id", "runId" FROM "run_logs";
DROP TABLE "run_logs";
ALTER TABLE "new_run_logs" RENAME TO "run_logs";
CREATE INDEX "run_logs_runId_idx" ON "run_logs"("runId");
CREATE INDEX "run_logs_createdAt_idx" ON "run_logs"("createdAt");
CREATE TABLE "new_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "lastProgressAt" DATETIME,
    "maxIterations" INTEGER NOT NULL,
    "currentIteration" INTEGER NOT NULL DEFAULT 0,
    "executorMode" TEXT NOT NULL DEFAULT 'local',
    "sandboxPath" TEXT NOT NULL,
    "sandboxBranch" TEXT,
    "selectedTaskIdsJson" TEXT NOT NULL,
    "lastTaskId" TEXT,
    "aiModel" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "lastMessage" TEXT,
    "lastCommand" TEXT,
    "lastCommandExitCode" INTEGER,
    "errorsJson" TEXT NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "pid" INTEGER,
    "prUrl" TEXT,
    "cancellationRequestedAt" DATETIME,
    "triggeredById" TEXT,
    CONSTRAINT "runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "runs_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "runs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_runs" ("cancellationRequestedAt", "createdAt", "currentIteration", "errorsJson", "executorMode", "finishedAt", "id", "lastCommand", "lastCommandExitCode", "lastMessage", "lastProgressAt", "lastTaskId", "maxIterations", "pid", "prUrl", "projectId", "reason", "runId", "sandboxBranch", "sandboxPath", "selectedTaskIdsJson", "sprintId", "startedAt", "status", "triggeredById") SELECT "cancellationRequestedAt", "createdAt", "currentIteration", "errorsJson", "executorMode", "finishedAt", "id", "lastCommand", "lastCommandExitCode", "lastMessage", "lastProgressAt", "lastTaskId", "maxIterations", "pid", "prUrl", "projectId", "reason", "runId", "sandboxBranch", "sandboxPath", "selectedTaskIdsJson", "sprintId", "startedAt", "status", "triggeredById" FROM "runs";
DROP TABLE "runs";
ALTER TABLE "new_runs" RENAME TO "runs";
CREATE UNIQUE INDEX "runs_runId_key" ON "runs"("runId");
CREATE INDEX "runs_projectId_idx" ON "runs"("projectId");
CREATE INDEX "runs_sprintId_idx" ON "runs"("sprintId");
CREATE INDEX "runs_status_idx" ON "runs"("status");
CREATE INDEX "runs_createdAt_idx" ON "runs"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
