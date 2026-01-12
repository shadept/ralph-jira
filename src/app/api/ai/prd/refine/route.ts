import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIClient } from "@/lib/ai/client";
import {
	PRD_REFINER_PROMPT,
	buildPrdRefinePrompt,
} from "@/lib/ai/prompts/prd";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";
import { getRepoAdapterForProject } from "@/lib/repo";
import { parseAiPreferences, parseTechStack } from "@/lib/schemas";

const RefinedPrdSchema = z.object({
	content: z.string().describe("The refined PRD content in markdown format"),
	improvements: z
		.array(z.string())
		.describe("List of key improvements made to the PRD"),
});

export async function POST(request: Request) {
	try {
		const { project } = await getProjectContext(request);
		const body = await request.json();

		const { prdId, focusAreas } = body;

		if (!prdId) {
			return NextResponse.json(
				{ error: "PRD ID is required", code: "MISSING_PRD_ID" },
				{ status: 400 },
			);
		}

		// Verify PRD belongs to project
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
					error: "PRD has no content to refine. Use 'Draft from Description' first.",
					code: "EMPTY_CONTENT",
				},
				{ status: 400 },
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
		const userPrompt = buildPrdRefinePrompt(prd.content, focusAreas);

		// Generate refined PRD content with structured output
		const result = await aiClient.runWithSchema(
			PRD_REFINER_PROMPT,
			userPrompt,
			RefinedPrdSchema,
		);

		// Update PRD with refined content
		const updatedPrd = await prisma.prd.update({
			where: { id: prdId },
			data: {
				content: result.output.content,
				updatedAt: new Date(),
			},
		});

		return NextResponse.json({
			success: true,
			prd: {
				id: updatedPrd.id,
				title: updatedPrd.title,
				content: updatedPrd.content,
				status: updatedPrd.status,
				priority: updatedPrd.priority,
				updatedAt: updatedPrd.updatedAt.toISOString(),
			},
			improvements: result.output.improvements,
			usage: result.usage,
			toolCalls: result.toolCalls.length,
		});
	} catch (error) {
		console.error("AI prd/refine error:", error);
		return handleProjectRouteError(error);
	}
}
