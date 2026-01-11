-- Update Task model: make title required and description optional
-- This migration preserves existing data by copying description to title where title is null

-- Step 1: Copy description to title for any rows where title is NULL
-- This ensures no data is lost during the schema change
UPDATE "tasks" SET "title" = "description" WHERE "title" IS NULL;

-- Step 2: For SQLite, we need to recreate the table to change column constraints
-- Create new table with updated schema
CREATE TABLE "tasks_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "acceptanceCriteriaJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "passes" BOOLEAN NOT NULL DEFAULT false,
    "estimate" INTEGER,
    "deadline" DATETIME,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "filesTouchedJson" TEXT NOT NULL DEFAULT '[]',
    "assigneeId" TEXT,
    "createdById" TEXT,
    "lastRun" DATETIME,
    "failureNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Step 3: Copy all data from old table to new table
INSERT INTO "tasks_new" (
    "id", "projectId", "sprintId", "category", "title", "description",
    "acceptanceCriteriaJson", "status", "priority", "passes", "estimate",
    "deadline", "tagsJson", "filesTouchedJson", "assigneeId", "createdById",
    "lastRun", "failureNotes", "createdAt", "updatedAt", "archivedAt"
)
SELECT
    "id", "projectId", "sprintId", "category", "title", "description",
    "acceptanceCriteriaJson", "status", "priority", "passes", "estimate",
    "deadline", "tagsJson", "filesTouchedJson", "assigneeId", "createdById",
    "lastRun", "failureNotes", "createdAt", "updatedAt", "archivedAt"
FROM "tasks";

-- Step 4: Drop old table
DROP TABLE "tasks";

-- Step 5: Rename new table to original name
ALTER TABLE "tasks_new" RENAME TO "tasks";

-- Step 6: Recreate indexes
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");
CREATE INDEX "tasks_sprintId_idx" ON "tasks"("sprintId");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_assigneeId_idx" ON "tasks"("assigneeId");
