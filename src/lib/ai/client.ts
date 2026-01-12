/**
 * Unified AI Client
 *
 * Provides a single interface for all AI operations with:
 * - Agentic tool calling loop for codebase exploration
 * - Structured output generation
 * - Clear separation between system prompts and user context
 *
 * API Design:
 * - systemPrompt: Agent persona and task instructions (reusable)
 * - userContext: Input data to process - PRD content, user request, etc. (variable)
 */

import { openai } from "@ai-sdk/openai";
import {
	type Tool as AITool,
	generateText,
	jsonSchema,
	Output,
	stepCountIs,
	ToolLoopAgent,
} from "ai";
import type { z } from "zod";
import { createToolRegistry, type ToolRegistry } from "./tools";
import type {
	AIClientConfig,
	AIResult,
	ProjectContext,
	TokenUsage,
	Tool,
	ToolCallLog,
} from "./types";

const DEFAULT_MODEL = "gpt-4-turbo";

/**
 * Internal prompt for codebase exploration phase.
 * Focused on gathering context, not generating final output.
 */
const CODEBASE_EXPLORER_PROMPT = `You are a codebase analyst. Your job is to explore the codebase and gather relevant context for the task at hand.

## Instructions

1. Start by calling get_file_tree to understand the project structure
2. Use find_files and search_code to locate relevant files
3. Read key files to understand existing patterns and implementations
4. Summarize your findings concisely, focusing on:
   - Relevant existing code and patterns
   - File locations that may need changes
   - Architectural considerations
   - Any constraints or conventions you observed

Be thorough but efficient. Focus on information that will help with the task.`;

export class AIClient {
	private config: AIClientConfig;
	private toolRegistry: ToolRegistry;

	constructor(config: AIClientConfig) {
		this.config = config;
		this.toolRegistry = createToolRegistry({
			repoAdapter: config.repoAdapter ?? undefined,
			toolSets: config.tools,
		});
	}

	/**
	 * Build system prompt with project context appended
	 */
	private buildSystemPrompt(basePrompt: string): string {
		let prompt = basePrompt;

		if (this.config.projectContext) {
			prompt += this.formatProjectContext(this.config.projectContext);
		}

		return prompt;
	}

	/**
	 * Build system prompt with project context AND codebase tool instructions
	 */
	private buildSystemPromptWithTools(basePrompt: string): string {
		let prompt = this.buildSystemPrompt(basePrompt);

		if (this.toolRegistry.size > 0) {
			prompt += `\n\n## Codebase Access

You have access to the project's codebase through the following tools:
- get_file_tree: Explore the directory structure
- read_files: Read file contents
- find_files: Find files by glob pattern
- search_code: Search for code patterns
- file_exists: Check if a file exists

Use these tools to explore the codebase and gather relevant context.`;
		}

		return prompt;
	}

	private formatProjectContext(context: ProjectContext): string {
		const parts = [
			"\n\n## Project Context",
			`Project: ${context.name}`,
			`Description: ${context.description}`,
			`Tech Stack: ${context.techStack.join(", ")}`,
		];

		if (context.conventions) {
			parts.push(`Conventions: ${context.conventions}`);
		}

		if (context.testingInfo) {
			parts.push(`Testing: ${context.testingInfo}`);
		}

		return parts.join("\n");
	}

	/**
	 * Convert our Tool to Vercel AI SDK's Tool format
	 */
	private translateTool(tool: Tool, name: string): AITool {
		return {
			description: tool.definition.description,
			inputSchema: jsonSchema(tool.definition.parameters),
			execute: async (args) => {
				const startTime = Date.now();
				const argsStr = JSON.stringify(args, null, 2);
				console.log(`[AI] Tool call: ${name}`);
				console.log(`[AI]    Args: ${argsStr}`);
				try {
					const result = await tool.execute(args as Record<string, unknown>);
					const duration = Date.now() - startTime;
					console.log(`[AI] Tool ${name} completed in ${duration}ms`);
					return result;
				} catch (error) {
					console.error(`[AI] Tool ${name} failed:`, error);
					throw error;
				}
			},
		};
	}

	/**
	 * Build tools for Vercel AI SDK
	 */
	private buildTools(): Record<string, AITool> | undefined {
		if (this.toolRegistry.size === 0) {
			return undefined;
		}

		const tools: Record<string, AITool> = {};

		for (const name of this.toolRegistry.getNames()) {
			const tool = this.toolRegistry.get(name);
			if (tool) {
				tools[name] = this.translateTool(tool, name);
			}
		}

		return Object.keys(tools).length > 0 ? tools : undefined;
	}

	/**
	 * Extract usage from AI SDK response
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private extractUsage(response: any): TokenUsage {
		const totalUsage = response.totalUsage ?? response.usage ?? {};
		const usage: TokenUsage = {
			promptTokens: totalUsage.promptTokens ?? 0,
			completionTokens: totalUsage.completionTokens ?? 0,
			totalTokens: 0,
		};
		usage.totalTokens = usage.promptTokens + usage.completionTokens;
		return usage;
	}

	/**
	 * Run agentic loop with tools
	 *
	 * Use this for tasks that require codebase exploration or multi-step reasoning.
	 *
	 * @param systemPrompt - Agent persona and task instructions
	 * @param userContext - Input data to process (PRD content, user request, etc.)
	 */
	private async run(
		systemPrompt: string,
		userContext: string,
	): Promise<AIResult<string>> {
		const startTime = Date.now();
		const toolCallLogs: ToolCallLog[] = [];

		const fullSystemPrompt = this.buildSystemPromptWithTools(systemPrompt);
		const model = this.config.model ?? DEFAULT_MODEL;
		const tools = this.buildTools();
		const maxSteps = this.config.maxToolCalls ?? 20;

		console.log(`[AI] run() starting`);
		console.log(`[AI]   Model: ${model}`);
		console.log(
			`[AI]   Tools: ${tools ? Object.keys(tools).join(", ") : "none"}`,
		);
		console.log(`[AI]   Max steps: ${maxSteps}`);
		console.log(
			`[AI]   User context: ${userContext.slice(0, 150)}${userContext.length > 150 ? "..." : ""}`,
		);

		const agent = new ToolLoopAgent({
			model: openai(model),
			tools: tools ?? {},
			instructions: fullSystemPrompt,
			stopWhen: stepCountIs(maxSteps),
			onStepFinish: (step) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const stepAny = step as any;
				if (stepAny.toolCalls?.length > 0) {
					console.log(
						`[AI]   Step completed: ${stepAny.toolCalls.length} tool call(s)`,
					);
				}
			},
		});

		const response = await agent.generate({ prompt: userContext });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const responseAny = response as any;
		const steps = responseAny.steps ?? [];

		// Extract tool calls from all steps
		for (const step of steps) {
			if (step.toolCalls) {
				for (const tc of step.toolCalls) {
					toolCallLogs.push({
						tool: tc.toolName,
						args: tc.args ?? {},
						result: null,
						durationMs: 0,
						success: true,
					});
				}
			}
		}

		const durationMs = Date.now() - startTime;
		console.log(
			`[AI] run() completed in ${durationMs}ms (${steps.length} steps, ${toolCallLogs.length} tool calls)`,
		);

		return {
			output: response.text,
			toolCalls: toolCallLogs,
			usage: this.extractUsage(responseAny),
			durationMs,
			iterations: steps.length || 1,
		};
	}

	/**
	 * Generate structured output (single call, no tools)
	 *
	 * Use this for straightforward generation tasks that don't need codebase access.
	 *
	 * @param systemPrompt - Agent persona and task instructions
	 * @param userContext - Input data to process (PRD content, user request, etc.)
	 * @param schema - Zod schema for structured output
	 */
	async generateStructured<T>(
		systemPrompt: string,
		userContext: string,
		schema: z.ZodSchema<T>,
	): Promise<AIResult<T>> {
		const startTime = Date.now();
		const fullSystemPrompt = this.buildSystemPrompt(systemPrompt);
		const model = this.config.model ?? DEFAULT_MODEL;

		console.log(`[AI] generateStructured() starting`);
		console.log(`[AI]   Model: ${model}`);
		console.log(
			`[AI]   User context: ${userContext.slice(0, 150)}${userContext.length > 150 ? "..." : ""}`,
		);

		const response = await generateText({
			model: openai(model),
			system: fullSystemPrompt,
			prompt: userContext,
			output: Output.object({ schema }),
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const responseAny = response as any;

		// The structured output location varies by SDK version
		const output =
			responseAny.experimental_output ??
			responseAny.object ??
			responseAny._output ??
			responseAny.output;

		if (!output) {
			console.error(`[AI] No structured output found`);
			console.error(`[AI]   Response keys:`, Object.keys(responseAny));
			console.error(`[AI]   Response text:`, responseAny.text?.slice(0, 500));
			throw new Error("AI did not return structured output");
		}

		const durationMs = Date.now() - startTime;
		console.log(`[AI] generateStructured() completed in ${durationMs}ms`);

		return {
			output: output as T,
			toolCalls: [],
			usage: this.extractUsage(responseAny),
			durationMs,
			iterations: 1,
		};
	}

	/**
	 * Generate structured output with codebase context (two-phase)
	 *
	 * Phase 1: Explore codebase using tools to gather relevant context
	 * Phase 2: Generate structured output using the gathered context
	 *
	 * Use this when the task benefits from understanding existing code patterns.
	 *
	 * @param systemPrompt - Agent persona and task instructions (used in phase 2)
	 * @param userContext - Input data to process (used in both phases)
	 * @param schema - Zod schema for structured output
	 */
	async generateWithCodebaseContext<T>(
		systemPrompt: string,
		userContext: string,
		schema: z.ZodSchema<T>,
	): Promise<AIResult<T> & { codebaseContext: string }> {
		const startTime = Date.now();
		let toolCallLogs: ToolCallLog[] = [];
		let codebaseContext = "";

		console.log(`[AI] generateWithCodebaseContext() starting`);

		// Phase 1: Explore codebase (only if tools available)
		if (this.toolRegistry.size > 0) {
			console.log(`[AI]   Phase 1: Exploring codebase...`);

			// Include the final task's system prompt so explorer knows what context to gather
			const explorationContext = `## Final Task
The gathered context will be used for the following task:

${systemPrompt}

## User Input
${userContext}

---
Explore the codebase to gather context relevant to completing the above task.`;

			const explorationResult = await this.run(
				CODEBASE_EXPLORER_PROMPT,
				explorationContext,
			);

			toolCallLogs = explorationResult.toolCalls;
			codebaseContext = explorationResult.output;

			console.log(
				`[AI]   Phase 1 complete: ${codebaseContext.length} chars, ${toolCallLogs.length} tool calls`,
			);
		} else {
			console.log(`[AI]   Phase 1 skipped: no tools available`);
		}

		// Phase 2: Generate structured output
		console.log(`[AI]   Phase 2: Generating structured output...`);

		const contextualUserPrompt = codebaseContext
			? `## Codebase Analysis\n${codebaseContext}\n\n## Task\n${userContext}`
			: userContext;

		const structuredResult = await this.generateStructured(
			systemPrompt,
			contextualUserPrompt,
			schema,
		);

		const durationMs = Date.now() - startTime;
		console.log(
			`[AI] generateWithCodebaseContext() completed in ${durationMs}ms`,
		);

		return {
			output: structuredResult.output,
			toolCalls: toolCallLogs,
			usage: structuredResult.usage,
			durationMs,
			iterations: toolCallLogs.length > 0 ? toolCallLogs.length + 1 : 1,
			codebaseContext,
		};
	}

	/**
	 * Get available tool names
	 */
	getAvailableTools(): string[] {
		return this.toolRegistry.getNames();
	}

	/**
	 * Check if repo tools are available
	 */
	hasRepoAccess(): boolean {
		return this.toolRegistry.has("get_file_tree");
	}
}

/**
 * Create an AI client with configuration
 */
export function createAIClient(config: AIClientConfig): AIClient {
	return new AIClient(config);
}
