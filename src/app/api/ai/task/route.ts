import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";

export async function POST(request: Request) {
	try {
		const { storage } = await getProjectStorage(request);
		const { action, boardId, taskId, data } = await request.json();

		const board = await storage.readBoard(boardId);
		const task = board.tasks.find((t) => t.id === taskId);

		if (!task) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 });
		}

		const settings = await storage.readSettings();

		switch (action) {
			case "improve-acceptance-criteria": {
				const result = await generateObject({
					model: openai(settings.aiPreferences.defaultModel || "gpt-4-turbo"),
					schema: z.object({
						acceptanceCriteria: z.array(z.string()),
						reasoning: z.string(),
					}),
					prompt: `Improve the acceptance criteria for this task to be more comprehensive and testable.

Task: ${task.description}
Category: ${task.category}

Current acceptance criteria:
${task.acceptanceCriteria.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Tech stack: ${settings.techStack.join(", ")}
Testing approach: ${settings.howToTest.notes}

Provide improved acceptance criteria that cover:
- Happy path scenarios
- Edge cases
- Error handling
- Performance/accessibility considerations
- Testing validation`,
				});

				task.acceptanceCriteria = result.object.acceptanceCriteria;
				task.updatedAt = new Date().toISOString();

				await storage.writeBoard(board);

				return NextResponse.json({
					success: true,
					acceptanceCriteria: result.object.acceptanceCriteria,
					reasoning: result.object.reasoning,
				});
			}

			case "add-edge-cases": {
				const result = await generateObject({
					model: openai(settings.aiPreferences.defaultModel || "gpt-4-turbo"),
					schema: z.object({
						edgeCases: z.array(z.string()),
					}),
					prompt: `Identify edge cases and additional test scenarios for this task:

Task: ${task.description}
Acceptance Criteria: ${task.acceptanceCriteria.join("; ")}

Consider:
- Boundary conditions
- Error states
- Race conditions
- Input validation
- Browser/device compatibility
- Performance under load`,
				});

				// Append edge cases to acceptance criteria
				task.acceptanceCriteria.push(
					...result.object.edgeCases.map((ec) => `[Edge case] ${ec}`),
				);
				task.updatedAt = new Date().toISOString();

				await storage.writeBoard(board);

				return NextResponse.json({
					success: true,
					edgeCases: result.object.edgeCases,
				});
			}

			case "estimate": {
				const result = await generateObject({
					model: openai(settings.aiPreferences.defaultModel || "gpt-4-turbo"),
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
Acceptance Criteria: ${task.acceptanceCriteria.length} items
Tech stack: ${settings.techStack.join(", ")}

Consider:
- Implementation complexity
- Testing requirements
- Unknown factors / risk
- Code review and revisions

Provide a detailed breakdown.`,
				});

				task.estimate = result.object.estimate;
				task.updatedAt = new Date().toISOString();

				await storage.writeBoard(board);

				return NextResponse.json({
					success: true,
					estimate: result.object.estimate,
					reasoning: result.object.reasoning,
					breakdown: result.object.breakdown,
				});
			}

			case "suggest-files": {
				const result = await generateObject({
					model: openai(settings.aiPreferences.defaultModel || "gpt-4-turbo"),
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
Acceptance Criteria: ${task.acceptanceCriteria.join("; ")}

Project structure (conventions):
${JSON.stringify(settings.repoConventions, null, 2)}

Tech stack: ${settings.techStack.join(", ")}

Provide specific file paths and what changes would be needed.`,
				});

				return NextResponse.json({
					success: true,
					files: result.object.files,
				});
			}

			case "to-test-cases": {
				const result = await generateText({
					model: openai(settings.aiPreferences.defaultModel || "gpt-4-turbo"),
					prompt: `Convert this task into automated test cases using the project's testing approach.

Task: ${task.description}
Acceptance Criteria: ${task.acceptanceCriteria.join("\n")}

Testing framework: ${settings.howToTest.commands.join(", ")}
Testing notes: ${settings.howToTest.notes}

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
