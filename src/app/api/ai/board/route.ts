import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function POST(request: Request) {
	try {
		const { project } = await getProjectContext(request);
		const { action, boardId, data } = await request.json();

		// Get sprint (board) with tasks
		const sprint = await prisma.sprint.findFirst({
			where: {
				id: boardId,
				projectId: project.id,
			},
			include: {
				tasks: { orderBy: { createdAt: "asc" } },
			},
		});

		if (!sprint) {
			return NextResponse.json({ error: "Board not found" }, { status: 404 });
		}

		// Get project settings
		const settings = await prisma.projectSettings.findUnique({
			where: { projectId: project.id },
		});

		const projectName = settings?.projectName || project.name;
		const projectDescription =
			settings?.projectDescription || project.description || "";
		const techStack = settings?.techStackJson
			? JSON.parse(settings.techStackJson)
			: [];
		const aiPreferences = settings?.aiPreferencesJson
			? JSON.parse(settings.aiPreferencesJson)
			: { defaultModel: "gpt-4-turbo" };

		// Transform tasks for processing
		const tasks = sprint.tasks.map((task) => ({
			id: task.id,
			category: task.category,
			title: task.title,
			description: task.description,
			acceptanceCriteria: JSON.parse(task.acceptanceCriteriaJson),
			status: task.status,
			priority: task.priority,
			passes: task.passes,
			estimate: task.estimate,
			tags: JSON.parse(task.tagsJson),
		}));

		switch (action) {
			case "generate-tasks": {
				const { description, count = 3, category = "functional" } = data;

				const result = await generateText({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					output: Output.object({
						schema: z.object({
							tasks: z.array(
								z.object({
									category: z.string(),
									description: z.string(),
									acceptanceCriteria: z.array(z.string()),
									priority: z.enum(["low", "medium", "high", "urgent"]),
									estimate: z.number(),
									tags: z.array(z.string()),
								}),
							),
						}),
					}),
					prompt: `Generate ${count} high-quality, focused tasks for the following feature or requirement:

"${description}"

Project Context:
- Project: ${projectName}
- Tech Stack: ${techStack.join(", ")}
- Description: ${projectDescription}

IMPORTANT Guidelines:
- Generate FEWER tasks (prefer 1-3) with more Acceptance Criteria that are meaningful and well-scoped
- Each task should represent a coherent unit of work, NOT a step-by-step guide
- Combine related work into single tasks rather than splitting unnecessarily
- Task descriptions should be concise and outcome-focused

Acceptance Criteria Guidelines:
- Write criteria that verify observable behavior or outcomes
- AVOID specifics that depend on unknowns (exact file paths, specific function names, implementation details)
- Use flexible language like "appropriate", "relevant", "as needed" for implementation-specific details
- Focus on WHAT should work, not HOW it should be implemented
- Keep criteria testable but not prescriptive

Category: ${category}`,
				});

				// Create tasks in database
				const newTasks = await Promise.all(
					result.output.tasks.map(async (t, _idx) => {
						const task = await prisma.task.create({
							data: {
								projectId: project.id,
								sprintId: sprint.id,
								category: t.category,
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
							category: task.category,
							description: task.description,
							acceptanceCriteria: JSON.parse(task.acceptanceCriteriaJson),
							status: task.status,
							priority: task.priority,
							passes: task.passes,
							estimate: task.estimate,
							tags: JSON.parse(task.tagsJson),
							filesTouched: [],
							createdAt: task.createdAt.toISOString(),
							updatedAt: task.updatedAt.toISOString(),
						};
					}),
				);

				return NextResponse.json({ success: true, tasks: newTasks });
			}

			case "prioritize": {
				const { criteria } = data;

				const result = await generateObject({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					schema: z.object({
						prioritized: z.array(
							z.object({
								taskId: z.string(),
								priority: z.enum(["low", "medium", "high", "urgent"]),
								reasoning: z.string(),
							}),
						),
					}),
					prompt: `Prioritize these tasks based on: ${criteria || "business value, dependencies, and risk"}

Tasks:
${tasks.map((t) => `- [${t.id}] ${t.description} (current: ${t.priority})`).join("\n")}

Project context: ${projectDescription}`,
				});

				// Update task priorities in database
				await Promise.all(
					result.object.prioritized.map(({ taskId, priority }) =>
						prisma.task.update({
							where: { id: taskId },
							data: { priority },
						}),
					),
				);

				return NextResponse.json({
					success: true,
					prioritized: result.object.prioritized,
				});
			}

			case "split-sprints": {
				const result = await generateObject({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					schema: z.object({
						sprints: z.array(
							z.object({
								name: z.string(),
								goal: z.string(),
								taskIds: z.array(z.string()),
								durationWeeks: z.number(),
							}),
						),
					}),
					prompt: `Split these ${tasks.length} tasks into logical sprints (2-3 week iterations).

Tasks:
${tasks.map((t) => `- [${t.id}] ${t.description} (${t.priority}, ${t.estimate || "?"} pts)`).join("\n")}

Consider:
- Dependencies between tasks
- Priority and risk
- Team velocity (assume ~20-30 pts per sprint)
- Logical groupings`,
				});

				return NextResponse.json({
					success: true,
					sprints: result.object.sprints,
				});
			}

			case "improve-acceptance": {
				const result = await generateText({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					prompt: `Review and improve the acceptance criteria for these tasks. Make them more specific, testable, and comprehensive.

Tasks:
${tasks
	.slice(0, 10)
	.map(
		(t) => `
Task: ${t.description}
Current acceptance criteria:
${t.acceptanceCriteria.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}
`,
	)
	.join("\n---\n")}

Provide improved acceptance criteria that are SMART (Specific, Measurable, Achievable, Relevant, Time-bound).`,
				});

				return NextResponse.json({
					success: true,
					improvements: result.text,
				});
			}

			default:
				return NextResponse.json({ error: "Unknown action" }, { status: 400 });
		}
	} catch (error) {
		console.error("AI board action error:", error);
		return handleProjectRouteError(error);
	}
}
