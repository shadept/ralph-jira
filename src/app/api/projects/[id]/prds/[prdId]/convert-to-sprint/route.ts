import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIClient } from "@/lib/ai/client";
import {
	buildPrdTaskGenerationPrompt,
	PRD_TASK_GENERATOR_PROMPT,
} from "@/lib/ai/prompts/prd";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";
import { getRepoAdapterForProject } from "@/lib/repo";
import { parseAiPreferences, parseTechStack } from "@/lib/schemas";
import { sanitizeQuotes, sanitizeStringArray } from "@/lib/utils";

// Schema for AI-generated tasks
// Note: All fields must be required for OpenAI structured output API
const GeneratedTaskSchema = z.object({
	title: z.string().describe("Clear, action-oriented task title"),
	description: z
		.string()
		.describe(
			"Task context referencing PRD sections (e.g., 'Implements FR-2.1: Email validation')",
		),
	category: z
		.enum(["feature", "bug", "chore", "refactor", "test", "docs"])
		.describe("Task category"),
	acceptanceCriteria: z
		.array(z.string())
		.describe("3-6 testable outcomes derived from PRD requirements"),
	priority: z
		.enum(["low", "medium", "high", "urgent"])
		.describe("Task priority: urgent=MVP blocker, high=important, medium=standard, low=nice-to-have"),
	estimate: z
		.number()
		.describe("Story points: 1=trivial, 2=simple, 3=moderate, 5=complex"),
	tags: z
		.array(z.string())
		.describe("2-4 tags for categorization (e.g., 'frontend', 'api', 'database', 'auth')"),
});

const TaskGenerationResultSchema = z.object({
	tasks: z
		.array(GeneratedTaskSchema)
		.describe("4-8 development tasks that fully implement the PRD"),
});

function formatSprint(sprint: {
	id: string;
	name: string;
	goal: string | null;
	deadline: Date;
	status: string;
	sourcePrdId: string | null;
	metricsJson: string | null;
	createdAt: Date;
	updatedAt: Date;
	columns: { columnId: string; name: string; order: number }[];
}) {
	return {
		id: sprint.id,
		name: sprint.name,
		goal: sprint.goal || "",
		deadline: sprint.deadline.toISOString(),
		status: sprint.status,
		sourcePrdId: sprint.sourcePrdId,
		columns: sprint.columns.map((col) => ({
			id: col.columnId,
			name: col.name,
			order: col.order,
		})),
		createdAt: sprint.createdAt.toISOString(),
		updatedAt: sprint.updatedAt.toISOString(),
	};
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string; prdId: string }> },
) {
	try {
		const { id, prdId } = await params;
		const { project } = await getProjectContextFromParams(id, request);
		const body = await request.json();

		// Verify PRD exists and belongs to this project
		const prd = await prisma.prd.findFirst({
			where: {
				id: prdId,
				projectId: project.id,
				deletedAt: null,
			},
		});

		if (!prd) {
			return NextResponse.json(
				{ error: "PRD not found", code: "PRD_NOT_FOUND" },
				{ status: 404 },
			);
		}

		// Validate required fields
		if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
			return NextResponse.json(
				{ error: "Sprint name is required", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		if (!body.deadline) {
			return NextResponse.json(
				{ error: "Sprint deadline is required", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		// Parse deadline
		const deadline = new Date(body.deadline);
		if (Number.isNaN(deadline.getTime())) {
			return NextResponse.json(
				{ error: "Invalid deadline date", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		// PRD must have content to generate tasks
		if (!prd.content?.trim()) {
			return NextResponse.json(
				{
					error:
						"PRD has no content. Add content to the PRD before converting to sprint.",
					code: "PRD_EMPTY",
				},
				{ status: 400 },
			);
		}

		// Get project settings for AI configuration
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
			// No repo configured - continue without codebase access
		}

		// Create AI client
		const aiClient = createAIClient({
			model: aiPreferences.defaultModel || "gpt-4-turbo",
			repoAdapter,
			projectContext: {
				name: projectName,
				description: projectDescription,
				techStack,
			},
		});

		// Generate tasks from PRD content FIRST (before creating sprint)
		// If this fails, we don't want to create an empty sprint
		const userPrompt = buildPrdTaskGenerationPrompt(prd.title, prd.content);

		const aiResult = await aiClient.generateWithCodebaseContext(
			PRD_TASK_GENERATOR_PROMPT,
			userPrompt,
			TaskGenerationResultSchema,
		);

		if (!aiResult.output.tasks || aiResult.output.tasks.length === 0) {
			return NextResponse.json(
				{
					error: "AI failed to generate tasks from PRD content",
					code: "AI_NO_TASKS",
				},
				{ status: 500 },
			);
		}

		// Create sprint and tasks in a transaction
		const { dbSprint, taskCount } = await prisma.$transaction(async (tx) => {
			// Create sprint with sourcePrdId linkage
			const sprint = await tx.sprint.create({
				data: {
					projectId: project.id,
					sourcePrdId: prdId,
					name: body.name.trim(),
					goal: body.goal?.trim() || prd.title,
					deadline,
					status: "planning",
					columns: {
						create: body.columns?.map(
							(col: { id: string; name: string; order: number }) => ({
								columnId: col.id,
								name: col.name,
								order: col.order,
							}),
						) || [
							{ columnId: "backlog", name: "Backlog", order: 0 },
							{ columnId: "todo", name: "To Do", order: 1 },
							{ columnId: "in_progress", name: "In Progress", order: 2 },
							{ columnId: "review", name: "Review", order: 3 },
							{ columnId: "done", name: "Done", order: 4 },
						],
					},
				},
				include: {
					columns: { orderBy: { order: "asc" } },
				},
			});

			// Create tasks with sanitized AI-generated text
			const taskData = aiResult.output.tasks.map((task) => ({
				projectId: project.id,
				sprintId: sprint.id,
				title: sanitizeQuotes(task.title),
				description: sanitizeQuotes(task.description),
				category: task.category,
				acceptanceCriteriaJson: JSON.stringify(
					sanitizeStringArray(task.acceptanceCriteria),
				),
				priority: task.priority,
				estimate: task.estimate,
				status: "backlog",
				tagsJson: JSON.stringify(sanitizeStringArray(task.tags)),
				filesTouchedJson: JSON.stringify([]),
			}));

			await tx.task.createMany({ data: taskData });

			return { dbSprint: sprint, taskCount: taskData.length };
		});

		const sprint = formatSprint(dbSprint);

		return NextResponse.json(
			{
				success: true,
				sprint,
				tasksGenerated: taskCount,
				message: `Sprint "${sprint.name}" created with ${taskCount} tasks from PRD "${prd.title}"`,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error converting PRD to sprint:", error);
		return handleProjectRouteError(error);
	}
}
