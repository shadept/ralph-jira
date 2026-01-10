import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
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
		const { action, taskId } = await request.json();

		// Get task
		const task = await prisma.task.findFirst({
			where: {
				id: taskId,
				projectId: project.id,
			},
		});

		if (!task) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 });
		}

		// Get project settings
		const settings = await prisma.projectSettings.findUnique({
			where: { projectId: project.id },
		});

		const techStack = settings?.techStackJson
			? JSON.parse(settings.techStackJson)
			: [];
		const howToTest = settings?.howToTestJson
			? JSON.parse(settings.howToTestJson)
			: { commands: [], notes: "" };
		const repoConventions = settings?.repoConventionsJson
			? JSON.parse(settings.repoConventionsJson)
			: { folders: {}, naming: "" };
		const aiPreferences = settings?.aiPreferencesJson
			? JSON.parse(settings.aiPreferencesJson)
			: { defaultModel: "gpt-4-turbo" };

		const acceptanceCriteria = JSON.parse(task.acceptanceCriteriaJson);

		switch (action) {
			case "improve-acceptance-criteria": {
				const result = await generateObject({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					schema: z.object({
						acceptanceCriteria: z.array(z.string()),
						reasoning: z.string(),
					}),
					prompt: `Improve the acceptance criteria for this task to be more comprehensive and testable.

Task: ${task.description}
Category: ${task.category}

Current acceptance criteria:
${acceptanceCriteria.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}

Tech stack: ${techStack.join(", ")}
Testing approach: ${howToTest.notes}

Provide improved acceptance criteria that cover:
- Happy path scenarios
- Edge cases
- Error handling
- Performance/accessibility considerations
- Testing validation`,
				});

				// Update task in database
				await prisma.task.update({
					where: { id: task.id },
					data: {
						acceptanceCriteriaJson: JSON.stringify(
							result.object.acceptanceCriteria,
						),
					},
				});

				return NextResponse.json({
					success: true,
					acceptanceCriteria: result.object.acceptanceCriteria,
					reasoning: result.object.reasoning,
				});
			}

			case "add-edge-cases": {
				const result = await generateObject({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					schema: z.object({
						edgeCases: z.array(z.string()),
					}),
					prompt: `Identify edge cases and additional test scenarios for this task:

Task: ${task.description}
Acceptance Criteria: ${acceptanceCriteria.join("; ")}

Consider:
- Boundary conditions
- Error states
- Race conditions
- Input validation
- Browser/device compatibility
- Performance under load`,
				});

				// Append edge cases to acceptance criteria
				const updatedCriteria = [
					...acceptanceCriteria,
					...result.object.edgeCases.map((ec) => `[Edge case] ${ec}`),
				];

				await prisma.task.update({
					where: { id: task.id },
					data: {
						acceptanceCriteriaJson: JSON.stringify(updatedCriteria),
					},
				});

				return NextResponse.json({
					success: true,
					edgeCases: result.object.edgeCases,
				});
			}

			case "estimate": {
				const result = await generateObject({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					schema: z.object({
						estimate: z.number(),
						reasoning: z.string(),
						breakdown: z.array(
							z.object({
								component: z.string(),
								points: z.number(),
							}),
						),
					}),
					prompt: `Estimate the effort for this task in story points (Fibonacci: 1, 2, 3, 5, 8, 13).

Task: ${task.description}
Acceptance Criteria: ${acceptanceCriteria.length} items
Tech stack: ${techStack.join(", ")}

Consider:
- Implementation complexity
- Testing requirements
- Unknown factors / risk
- Code review and revisions

Provide a detailed breakdown.`,
				});

				await prisma.task.update({
					where: { id: task.id },
					data: { estimate: result.object.estimate },
				});

				return NextResponse.json({
					success: true,
					estimate: result.object.estimate,
					reasoning: result.object.reasoning,
					breakdown: result.object.breakdown,
				});
			}

			case "suggest-files": {
				const result = await generateObject({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					schema: z.object({
						files: z.array(
							z.object({
								path: z.string(),
								purpose: z.string(),
								changes: z.string(),
							}),
						),
					}),
					prompt: `Suggest which files would need to be modified to implement this task:

Task: ${task.description}
Acceptance Criteria: ${acceptanceCriteria.join("; ")}

Project structure (conventions):
${JSON.stringify(repoConventions, null, 2)}

Tech stack: ${techStack.join(", ")}

Provide specific file paths and what changes would be needed.`,
				});

				return NextResponse.json({
					success: true,
					files: result.object.files,
				});
			}

			case "to-test-cases": {
				const result = await generateText({
					model: openai(aiPreferences.defaultModel || "gpt-4-turbo"),
					prompt: `Convert this task into automated test cases using the project's testing approach.

Task: ${task.description}
Acceptance Criteria: ${acceptanceCriteria.join("\n")}

Testing framework: ${howToTest.commands.join(", ")}
Testing notes: ${howToTest.notes}

Generate test code snippets or pseudocode.`,
				});

				return NextResponse.json({
					success: true,
					testCases: result.text,
				});
			}

			default:
				return NextResponse.json({ error: "Unknown action" }, { status: 400 });
		}
	} catch (error) {
		console.error("AI task action error:", error);
		return handleProjectRouteError(error);
	}
}
