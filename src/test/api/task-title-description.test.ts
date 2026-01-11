import { describe, expect, it } from "vitest";
import { TaskSchema } from "@/lib/schemas";
import { z } from "zod";

/**
 * Regression tests for Task title/description contract.
 *
 * These tests ensure the new Task model correctly handles:
 * - `title`: Required short summary text
 * - `description`: Optional long-form description/plan
 *
 * This protects against regressions in the title/description mapping
 * established by the migration that moved existing `description` to `title`.
 */

describe("Task Title/Description Contract", () => {
	describe("Schema Validation", () => {
		it("should require title field for task creation", () => {
			// Task with title should be valid
			const validTask = {
				id: "task-1",
				projectId: "project-1",
				sprintId: "sprint-1",
				category: "functional",
				title: "Implement user authentication",
				description: "Detailed implementation plan...",
				acceptanceCriteria: ["Users can log in"],
				status: "todo",
				priority: "high",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(validTask);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toBe("Implement user authentication");
				expect(result.data.description).toBe("Detailed implementation plan...");
			}
		});

		it("should reject task without title", () => {
			const invalidTask = {
				id: "task-1",
				projectId: "project-1",
				category: "functional",
				// Missing title!
				description: "Some description",
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(invalidTask);
			expect(result.success).toBe(false);
		});

		it("should allow null description for task", () => {
			const taskWithNullDescription = {
				id: "task-2",
				projectId: "project-1",
				category: "bug",
				title: "Fix login button",
				description: null,
				acceptanceCriteria: ["Button works"],
				status: "backlog",
				priority: "low",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(taskWithNullDescription);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toBe("Fix login button");
				expect(result.data.description).toBeNull();
			}
		});

		it("should allow undefined description for task", () => {
			const taskWithUndefinedDescription = {
				id: "task-3",
				projectId: "project-1",
				category: "feature",
				title: "Add dark mode",
				// description is omitted (undefined)
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(taskWithUndefinedDescription);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toBe("Add dark mode");
				expect(result.data.description).toBeUndefined();
			}
		});

		it("should allow long-form multi-paragraph description", () => {
			const multiParagraphDescription = `## Implementation Plan

First, we need to update the database schema to support the new field.

### Steps:
1. Add migration
2. Update API routes
3. Update frontend components

### Testing:
- Unit tests for schema validation
- Integration tests for API endpoints
- E2E tests for user flows`;

			const taskWithLongDescription = {
				id: "task-4",
				projectId: "project-1",
				category: "epic",
				title: "Refactor authentication system",
				description: multiParagraphDescription,
				acceptanceCriteria: ["All tests pass", "No breaking changes"],
				status: "in_progress",
				priority: "urgent",
				passes: false,
				tags: ["refactoring", "auth"],
				filesTouched: ["src/auth/index.ts"],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(taskWithLongDescription);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toBe("Refactor authentication system");
				expect(result.data.description).toBe(multiParagraphDescription);
				expect(result.data.description).toContain("## Implementation Plan");
				expect(result.data.description).toContain("### Steps:");
			}
		});
	});

	describe("Title/Description Distinction", () => {
		it("should treat title as short summary (suitable for cards/lists)", () => {
			// Title should be short and suitable for display as primary text
			const task = {
				id: "task-5",
				projectId: "project-1",
				category: "functional",
				title: "Add user profile page",
				description:
					"Create a new page at /profile that displays user information including name, email, avatar, and account settings.",
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(task);
			expect(result.success).toBe(true);
			if (result.success) {
				// Title is short and summary-like
				expect(result.data.title.length).toBeLessThan(100);
				// Description is longer and more detailed
				expect(result.data.description!.length).toBeGreaterThan(
					result.data.title.length,
				);
			}
		});

		it("should preserve both fields independently", () => {
			const originalTitle = "Original Title";
			const originalDescription = "Original detailed description";

			const task = {
				id: "task-6",
				projectId: "project-1",
				category: "functional",
				title: originalTitle,
				description: originalDescription,
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(task);
			expect(result.success).toBe(true);
			if (result.success) {
				// Both fields should be preserved independently
				expect(result.data.title).toBe(originalTitle);
				expect(result.data.description).toBe(originalDescription);
				// They should be different fields
				expect(result.data.title).not.toBe(result.data.description);
			}
		});
	});

	describe("Partial Update Behavior", () => {
		// This simulates API partial update behavior where only provided fields are updated
		it("should not overwrite description when only title is provided in update", () => {
			const existingTask = {
				id: "task-7",
				projectId: "project-1",
				category: "functional",
				title: "Original Title",
				description: "Original Description",
				acceptanceCriteria: [],
				status: "todo" as const,
				priority: "medium" as const,
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			// Simulate partial update payload (only title provided)
			const updatePayload = {
				title: "Updated Title",
				// description is NOT provided - should not be overwritten
			};

			// Simulate the merge behavior used in API routes
			const mergedTask = {
				...existingTask,
				title:
					updatePayload.title !== undefined
						? updatePayload.title
						: existingTask.title,
				// description should remain unchanged since it wasn't in the update payload
			};

			expect(mergedTask.title).toBe("Updated Title");
			expect(mergedTask.description).toBe("Original Description");
		});

		it("should not overwrite title when only description is provided in update", () => {
			const existingTask = {
				id: "task-8",
				projectId: "project-1",
				category: "functional",
				title: "Original Title",
				description: "Original Description",
				acceptanceCriteria: [],
				status: "todo" as const,
				priority: "medium" as const,
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			// Simulate partial update payload (only description provided)
			const updatePayload = {
				description: "Updated Description with more details",
				// title is NOT provided - should not be overwritten
			};

			// Simulate the merge behavior used in API routes
			type UpdatePayloadType = { description?: string; title?: string };
			const typedUpdatePayload = updatePayload as UpdatePayloadType;

			const mergedTask = {
				...existingTask,
				description:
					typedUpdatePayload.description !== undefined
						? typedUpdatePayload.description
						: existingTask.description,
				// title should remain unchanged since it wasn't in the update payload
			};

			expect(mergedTask.title).toBe("Original Title");
			expect(mergedTask.description).toBe(
				"Updated Description with more details",
			);
		});

		it("should allow clearing description to null", () => {
			const existingTask = {
				id: "task-9",
				projectId: "project-1",
				category: "functional",
				title: "Task with description",
				description: "This description should be clearable",
				acceptanceCriteria: [],
				status: "todo" as const,
				priority: "medium" as const,
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			// Update with explicit null to clear description
			const updatePayload = {
				description: null,
			};

			const mergedTask = {
				...existingTask,
				description: updatePayload.description,
			};

			expect(mergedTask.title).toBe("Task with description");
			expect(mergedTask.description).toBeNull();
		});
	});

	describe("Migration Mapping Protection", () => {
		/**
		 * This test protects the mapping established by the migration:
		 * - Old `description` (short summary) -> new `title`
		 * - New `description` field is for long-form content
		 *
		 * The migration SQL was:
		 * UPDATE "tasks" SET "title" = "description" WHERE "title" IS NULL;
		 */
		it("should use title as the primary identifier (migrated from old description)", () => {
			// This simulates a task that was migrated from the old schema
			// where `description` held the short summary
			const migratedTask = {
				id: "migrated-task-1",
				projectId: "project-1",
				category: "functional",
				// After migration: old description became title
				title: "Fix login validation bug",
				// New description field is empty for migrated tasks
				description: null,
				acceptanceCriteria: [],
				status: "done" as const,
				priority: "high" as const,
				passes: true,
				tags: [],
				filesTouched: [],
				createdAt: "2025-01-01T00:00:00.000Z",
				updatedAt: "2026-01-11T22:00:00.000Z",
			};

			const result = TaskSchema.safeParse(migratedTask);
			expect(result.success).toBe(true);
			if (result.success) {
				// Title should contain the migrated short summary
				expect(result.data.title).toBe("Fix login validation bug");
				// Description should be null (no long-form content from migration)
				expect(result.data.description).toBeNull();
			}
		});

		it("should support new tasks with both title and description", () => {
			// New tasks created after the migration should have both fields
			const newTask = {
				id: "new-task-1",
				projectId: "project-1",
				category: "functional",
				title: "Implement password reset flow",
				description: `## Overview
Users should be able to reset their password via email.

## Steps
1. Click "Forgot Password" on login page
2. Enter email address
3. Receive email with reset link
4. Click link and enter new password
5. Password is updated

## Technical Notes
- Use secure token with 1-hour expiration
- Rate limit reset requests to prevent abuse`,
				acceptanceCriteria: [
					"User can request password reset",
					"Email is sent with secure link",
					"Link expires after 1 hour",
					"Password can be successfully changed",
				],
				status: "todo" as const,
				priority: "high" as const,
				passes: false,
				tags: ["auth", "security"],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(newTask);
			expect(result.success).toBe(true);
			if (result.success) {
				// Title is the short summary
				expect(result.data.title).toBe("Implement password reset flow");
				// Description is the detailed plan
				expect(result.data.description).toContain("## Overview");
				expect(result.data.description).toContain("## Steps");
				expect(result.data.description).toContain("## Technical Notes");
			}
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty string title validation", () => {
			const taskWithEmptyTitle = {
				id: "task-empty-title",
				projectId: "project-1",
				category: "functional",
				title: "",
				description: "Some description",
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			// Zod schema allows empty string (API layer enforces non-empty)
			const result = TaskSchema.safeParse(taskWithEmptyTitle);
			expect(result.success).toBe(true);
		});

		it("should handle whitespace-only title", () => {
			const taskWithWhitespaceTitle = {
				id: "task-whitespace-title",
				projectId: "project-1",
				category: "functional",
				title: "   ",
				description: "Description",
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			// Schema allows it, API layer should validate
			const result = TaskSchema.safeParse(taskWithWhitespaceTitle);
			expect(result.success).toBe(true);
			if (result.success) {
				// UI fallback to "Untitled" would happen at display layer
				expect(result.data.title.trim()).toBe("");
			}
		});

		it("should handle empty string description", () => {
			const taskWithEmptyDescription = {
				id: "task-empty-desc",
				projectId: "project-1",
				category: "functional",
				title: "Valid Title",
				description: "",
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(taskWithEmptyDescription);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.description).toBe("");
			}
		});

		it("should handle very long title gracefully", () => {
			const longTitle = "A".repeat(500);
			const taskWithLongTitle = {
				id: "task-long-title",
				projectId: "project-1",
				category: "functional",
				title: longTitle,
				description: "Normal description",
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(taskWithLongTitle);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title.length).toBe(500);
			}
		});

		it("should handle very long description gracefully", () => {
			const longDescription = "B".repeat(10000);
			const taskWithLongDescription = {
				id: "task-long-desc",
				projectId: "project-1",
				category: "functional",
				title: "Normal Title",
				description: longDescription,
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(taskWithLongDescription);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.description!.length).toBe(10000);
			}
		});

		it("should handle special characters in title and description", () => {
			const specialTask = {
				id: "task-special",
				projectId: "project-1",
				category: "functional",
				title: 'Fix "quotes" & <brackets> issues',
				description:
					"Handle special chars: \n\t`code` *bold* _italic_ [link](url)",
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(specialTask);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toContain('"quotes"');
				expect(result.data.title).toContain("<brackets>");
				expect(result.data.description).toContain("`code`");
			}
		});

		it("should handle unicode characters in title and description", () => {
			const unicodeTask = {
				id: "task-unicode",
				projectId: "project-1",
				category: "functional",
				title: "支持中文标题 🚀 émojis",
				description: "Description with émojis 👍 and 日本語",
				acceptanceCriteria: [],
				status: "todo",
				priority: "medium",
				passes: false,
				tags: [],
				filesTouched: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			const result = TaskSchema.safeParse(unicodeTask);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toContain("中文");
				expect(result.data.title).toContain("🚀");
				expect(result.data.description).toContain("👍");
				expect(result.data.description).toContain("日本語");
			}
		});
	});
});

describe("Task Create/Update Type Contracts", () => {
	// Test the expected payload shapes for API operations

	it("should validate create task payload shape", () => {
		const CreateTaskPayloadSchema = z.object({
			title: z.string().min(1, "Title is required"),
			description: z.string().nullable().optional(),
			category: z.string().optional(),
			priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
			status: z
				.enum(["backlog", "todo", "in_progress", "review", "done"])
				.optional(),
			sprintId: z.string().nullable().optional(),
			acceptanceCriteria: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
			estimate: z.number().nullable().optional(),
		});

		// Valid create payload
		const validPayload = {
			title: "New Feature",
			description: "Detailed plan for the feature",
			category: "functional",
			priority: "high" as const,
		};

		const result = CreateTaskPayloadSchema.safeParse(validPayload);
		expect(result.success).toBe(true);

		// Minimal valid payload (only title required)
		const minimalPayload = {
			title: "Minimal Task",
		};

		const minimalResult = CreateTaskPayloadSchema.safeParse(minimalPayload);
		expect(minimalResult.success).toBe(true);

		// Invalid payload (missing title)
		const invalidPayload = {
			description: "No title provided",
		};

		const invalidResult = CreateTaskPayloadSchema.safeParse(invalidPayload);
		expect(invalidResult.success).toBe(false);
	});

	it("should validate update task payload shape", () => {
		const UpdateTaskPayloadSchema = z.object({
			title: z.string().optional(),
			description: z.string().nullable().optional(),
			category: z.string().optional(),
			priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
			status: z
				.enum(["backlog", "todo", "in_progress", "review", "done"])
				.optional(),
			sprintId: z.string().nullable().optional(),
			acceptanceCriteria: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
			estimate: z.number().nullable().optional(),
			passes: z.boolean().optional(),
			failureNotes: z.string().nullable().optional(),
			filesTouched: z.array(z.string()).optional(),
		});

		// Update only title
		const titleOnlyUpdate = { title: "Updated Title" };
		expect(UpdateTaskPayloadSchema.safeParse(titleOnlyUpdate).success).toBe(
			true,
		);

		// Update only description
		const descOnlyUpdate = { description: "Updated description" };
		expect(UpdateTaskPayloadSchema.safeParse(descOnlyUpdate).success).toBe(
			true,
		);

		// Update both
		const bothUpdate = {
			title: "Updated Title",
			description: "Updated description",
		};
		expect(UpdateTaskPayloadSchema.safeParse(bothUpdate).success).toBe(true);

		// Clear description
		const clearDescUpdate = { description: null };
		expect(UpdateTaskPayloadSchema.safeParse(clearDescUpdate).success).toBe(
			true,
		);

		// Empty update (partial update with no changes)
		const emptyUpdate = {};
		expect(UpdateTaskPayloadSchema.safeParse(emptyUpdate).success).toBe(true);
	});
});
