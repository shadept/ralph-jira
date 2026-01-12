import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIClient } from "@/lib/ai/client";
import {
	buildPrdTaskGenerationPrompt,
	PRD_TASK_GENERATOR_PROMPT,
} from "@/lib/ai/prompts/prd";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";
import { getRepoAdapterForProject } from "@/lib/repo";
import { parseAiPreferences, parseTechStack } from "@/lib/schemas";

const GeneratedTaskSchema = z.object({
	tasks: z.array(
		z.object({
			title: z.string().describe("Short, action-oriented task title"),
			description: z
				.string()
				.describe("Brief context about what and why, referencing the PRD"),
			acceptanceCriteria: z
				.array(z.string())
				.describe(
					"Testable outcomes for the task derived from PRD requirements",
				),
			priority: z.enum(["low", "medium", "high", "urgent"]),
			estimate: z.number().describe("Story points: 1, 2, 3, 5, 8, or 13"),
			tags: z.array(z.string()).describe("Relevant tags for categorization"),
		}),
	),
});

export async function POST(request: Request) {
	try {
		const { project } = await getProjectContext(request);
		const body = await request.json();

		const { prdId, sprintId, taskCount, category = "functional" } = body;

		if (!prdId) {
			return NextResponse.json(
				{ error: "PRD ID is required", code: "MISSING_PRD_ID" },
				{ status: 400 },
			);
		}

		if (!sprintId) {
			return NextResponse.json(
				{ error: "Sprint ID is required", code: "MISSING_SPRINT_ID" },
				{ status: 400 },
			);
		}

		// Verify PRD belongs to project and has content
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

		if (!prd.content?.trim()) {
			return NextResponse.json(
				{
					error:
						"PRD has no content. Please add content to the PRD before generating tasks.",
					code: "PRD_EMPTY",
				},
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

		// Build user prompt from PRD content
		const userPrompt = buildPrdTaskGenerationPrompt(prd.title, prd.content, {
			taskCount,
			category,
		});

		// Generate tasks with structured output
		const result = await aiClient.runWithSchema(
			PRD_TASK_GENERATOR_PROMPT,
			userPrompt,
			GeneratedTaskSchema,
		);

		// Create tasks in database
		const newTasks = await Promise.all(
			result.output.tasks.map(async (t) => {
				const task = await prisma.task.create({
					data: {
						projectId: project.id,
						sprintId: sprint.id,
						category,
						title: t.title,
						description: t.description,
						acceptanceCriteriaJson: JSON.stringify(t.acceptanceCriteria),
						priority: t.priority,
						estimate: t.estimate,
						tagsJson: JSON.stringify(t.tags),
						status: "backlog",
						passes: false,
						filesTouchedJson: "[]",
					},
				});

				return {
					id: task.id,
					projectId: task.projectId,
					sprintId: task.sprintId,
					title: task.title,
					category: task.category,
					description: task.description,
					acceptanceCriteria: t.acceptanceCriteria,
					status: task.status,
					priority: task.priority,
					passes: task.passes,
					estimate: task.estimate,
					tags: t.tags,
					filesTouched: [],
					createdAt: task.createdAt.toISOString(),
					updatedAt: task.updatedAt.toISOString(),
				};
			}),
		);

		return NextResponse.json({
			success: true,
			tasks: newTasks,
			taskCount: newTasks.length,
			sprintId: sprint.id,
			sprintName: sprint.name,
			prdId: prd.id,
			prdTitle: prd.title,
			usage: result.usage,
			toolCalls: result.toolCalls.length,
		});
	} catch (error) {
		console.error("AI prd/generate-tasks error:", error);
		return handleProjectRouteError(error);
	}
}
