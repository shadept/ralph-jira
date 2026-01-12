import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIClient } from "@/lib/ai/client";
import { TASK_GENERATOR_PROMPT } from "@/lib/ai/prompts/base";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";
import { getRepoAdapterForProject } from "@/lib/repo";
import { parseAiPreferences, parseTechStack } from "@/lib/schemas";
import { sanitizeQuotes, sanitizeStringArray } from "@/lib/utils";

// Note: All fields must be required for OpenAI structured output API
const GeneratedTaskSchema = z.object({
	tasks: z.array(
		z.object({
			title: z.string().describe("Clear, action-oriented task title"),
			description: z.string().describe("Brief context about what and why"),
			category: z
				.enum(["feature", "bug", "chore", "refactor", "test", "docs"])
				.describe("Task category"),
			acceptanceCriteria: z
				.array(z.string())
				.describe("3-6 testable outcomes"),
			priority: z
				.enum(["low", "medium", "high", "urgent"])
				.describe(
					"Task priority: urgent=blocker, high=important, medium=standard, low=nice-to-have",
				),
			estimate: z
				.number()
				.describe("Story points: 1=trivial, 2=simple, 3=moderate, 5=complex"),
			tags: z
				.array(z.string())
				.describe("2-4 tags for categorization (e.g., 'frontend', 'api', 'database', 'auth')"),
		}),
	),
});

export async function POST(request: Request) {
	try {
		const { project } = await getProjectContext(request);
		const body = await request.json();

		const { sprintId, description, count = 3, category = "functional" } = body;

		if (!sprintId) {
			return NextResponse.json(
				{ error: "Sprint ID is required", code: "MISSING_SPRINT_ID" },
				{ status: 400 },
			);
		}

		if (!description?.trim()) {
			return NextResponse.json(
				{ error: "Description is required", code: "MISSING_DESCRIPTION" },
				{ status: 400 },
			);
		}

		// Verify sprint belongs to project
		const sprint = await prisma.sprint.findFirst({
			where: {
				id: sprintId,
				projectId: project.id,
			},
		});

		if (!sprint) {
			return NextResponse.json(
				{ error: "Sprint not found", code: "SPRINT_NOT_FOUND" },
				{ status: 404 },
			);
		}

		// Get project settings
		const settings = await prisma.projectSettings.findUnique({
			where: { projectId: project.id },
		});

		const projectName = settings?.projectName || project.name;
		const projectDescription =
			settings?.projectDescription || project.description || "";
		const techStack = parseTechStack(settings?.techStackJson);
		const aiPreferences = parseAiPreferences(settings?.aiPreferencesJson);

		// Get repo adapter if project has a repo URL
		let repoAdapter = null;
		try {
			repoAdapter = await getRepoAdapterForProject(project);
		} catch {
			// No repo configured or not accessible - continue without codebase access
		}

		// Create AI client with repo access if available
		const aiClient = createAIClient({
			model: aiPreferences.defaultModel || "gpt-4-turbo",
			repoAdapter,
			projectContext: {
				name: projectName,
				description: projectDescription,
				techStack,
			},
		});

		// Build user prompt
		const userPrompt = `Generate ${count} high-quality, focused tasks for the following feature or requirement:

"${description}"

Category: ${category}

Guidelines:
- Generate FEWER tasks (prefer 1-3) with more acceptance criteria that are meaningful and well-scoped
- Each task should represent a coherent unit of work, NOT a step-by-step guide
- Combine related work into single tasks rather than splitting unnecessarily
- Task descriptions should be concise and outcome-focused
- Avoid specifics that depend on unknowns (exact file paths, specific function names)
- Use flexible language like "appropriate", "relevant", "as needed" for implementation details
- Focus on WHAT should work, not HOW it should be implemented`;

		// Generate tasks with structured output
		// Use generateWithCodebaseContext to leverage codebase analysis if available
		const result = await aiClient.generateWithCodebaseContext(
			TASK_GENERATOR_PROMPT,
			userPrompt,
			GeneratedTaskSchema,
		);

		// Create tasks in database
		const newTasks = await Promise.all(
			result.output.tasks.map(async (t) => {
				// Sanitize AI-generated text to replace smart quotes with ASCII quotes
				const sanitizedAcceptanceCriteria = sanitizeStringArray(
					t.acceptanceCriteria,
				);
				const sanitizedTags = sanitizeStringArray(t.tags);
				const sanitizedTitle = sanitizeQuotes(t.title);
				const sanitizedDescription = sanitizeQuotes(t.description);

				const task = await prisma.task.create({
					data: {
						projectId: project.id,
						sprintId: sprint.id,
						category: t.category,
						title: sanitizedTitle,
						description: sanitizedDescription,
						acceptanceCriteriaJson: JSON.stringify(sanitizedAcceptanceCriteria),
						priority: t.priority,
						estimate: t.estimate,
						tagsJson: JSON.stringify(sanitizedTags),
						status: "backlog",
						passes: false,
						filesTouchedJson: "[]",
					},
				});

				return {
					id: task.id,
					title: task.title,
					category: task.category,
					description: task.description,
					acceptanceCriteria: sanitizedAcceptanceCriteria,
					status: task.status,
					priority: task.priority,
					passes: task.passes,
					estimate: task.estimate,
					tags: sanitizedTags,
					filesTouched: [],
					createdAt: task.createdAt.toISOString(),
					updatedAt: task.updatedAt.toISOString(),
				};
			}),
		);

		return NextResponse.json({
			success: true,
			tasks: newTasks,
			usage: result.usage,
			toolCalls: result.toolCalls.length,
		});
	} catch (error) {
		console.error("AI generate-tasks error:", error);
		return handleProjectRouteError(error);
	}
}
