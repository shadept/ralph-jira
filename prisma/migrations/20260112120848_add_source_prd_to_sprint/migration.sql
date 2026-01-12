-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sprints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sourcePrdId" TEXT,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "metricsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "sprints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sprints_sourcePrdId_fkey" FOREIGN KEY ("sourcePrdId") REFERENCES "prds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sprints" ("archivedAt", "createdAt", "deadline", "goal", "id", "metricsJson", "name", "projectId", "status", "updatedAt") SELECT "archivedAt", "createdAt", "deadline", "goal", "id", "metricsJson", "name", "projectId", "status", "updatedAt" FROM "sprints";
DROP TABLE "sprints";
ALTER TABLE "new_sprints" RENAME TO "sprints";
CREATE INDEX "sprints_projectId_idx" ON "sprints"("projectId");
CREATE INDEX "sprints_status_idx" ON "sprints"("status");
CREATE INDEX "sprints_sourcePrdId_idx" ON "sprints"("sourcePrdId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
