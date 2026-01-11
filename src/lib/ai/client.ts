/**
 * Unified AI Client
 *
 * Provides a single interface for all AI operations with:
 * - Automatic repo tool access when available
 * - Manual agentic loop for tool calling
 * - Structured output support
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
	 * Build the full system prompt with project context
	 */
	private buildSystemPrompt(basePrompt: string): string {
		let prompt = basePrompt;

		if (this.config.projectContext) {
			prompt += this.formatProjectContext(this.config.projectContext);
		}

		if (this.config.repoAdapter) {
			prompt += `\n\n## Codebase Access

You have access to the project's codebase through the following tools:
- get_file_tree: Explore the directory structure
- read_files: Read file contents
- find_files: Find files by glob pattern
- search_code: Search for code patterns
- file_exists: Check if a file exists

Always explore the codebase to understand the existing implementation before making recommendations.
Start by calling get_file_tree to understand the project structure.`;
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
				console.log(`[AI] 🔧 Tool call: ${name}`);
				console.log(`[AI]    Args: ${argsStr}`);
				try {
					const result = await tool.execute(args as Record<string, unknown>);
					const duration = Date.now() - startTime;
					console.log(`[AI] ✅ Tool ${name} completed in ${duration}ms`);
					return result;
				} catch (error) {
					console.error(`[AI] ❌ Tool ${name} failed:`, error);
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
	 * Run AI with simple approach - single call with tools
	 */
	async run(
		systemPrompt: string,
		userMessage: string,
	): Promise<AIResult<string>> {
		const startTime = Date.now();
		const toolCallLogs: ToolCallLog[] = [];

		const fullSystemPrompt = this.buildSystemPrompt(systemPrompt);
		const model = this.config.model ?? DEFAULT_MODEL;
		const tools = this.buildTools();

		const maxSteps = this.config.maxToolCalls ?? 20;

		console.log(`[AI] 🚀 Starting run with model: ${model}`);
		console.log(
			`[AI] 💬 Prompt: ${userMessage.slice(0, 200)}${userMessage.length > 200 ? "..." : ""}`,
		);
		console.log(
			`[AI] 📝 Available tools: ${tools ? Object.keys(tools).join(", ") : "none"}`,
		);
		console.log(`[AI] 🔄 Max steps: ${maxSteps}`);

		// Use ToolLoopAgent for proper agentic tool calling loop
		const agent = new ToolLoopAgent({
			model: openai(model),
			tools: tools ?? {},
			instructions: fullSystemPrompt,
			stopWhen: stepCountIs(maxSteps),
			onStepFinish: (step) => {
				// Log each step as it completes
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const stepAny = step as any;
				if (stepAny.toolCalls?.length > 0) {
					console.log(
						`[AI] 📍 Step completed with ${stepAny.toolCalls.length} tool call(s)`,
					);
				}
			},
		});

		const response = await agent.generate({
			prompt: userMessage,
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const responseAny = response as any;
		const steps = responseAny.steps ?? [];

		console.log(
			`[AI] ✨ Run completed in ${Date.now() - startTime}ms (${steps.length} steps)`,
		);

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

		// Extract usage from totalUsage (aggregated across all steps)
		const totalUsage = responseAny.totalUsage ?? responseAny.usage ?? {};
		const usage: TokenUsage = {
			promptTokens: totalUsage.promptTokens ?? 0,
			completionTokens: totalUsage.completionTokens ?? 0,
			totalTokens: 0,
		};
		usage.totalTokens = usage.promptTokens + usage.completionTokens;

		return {
			output: response.text,
			toolCalls: toolCallLogs,
			usage,
			durationMs: Date.now() - startTime,
			iterations: steps.length || 1,
		};
	}

	/**
	 * Run AI and parse output with Zod schema
	 */
	async runWithSchema<T>(
		systemPrompt: string,
		userMessage: string,
		schema: z.ZodSchema<T>,
	): Promise<AIResult<T>> {
		const startTime = Date.now();
		const fullSystemPrompt = this.buildSystemPrompt(systemPrompt);
		const model = this.config.model ?? DEFAULT_MODEL;

		console.log(`[AI] 🎯 Starting runWithSchema with model: ${model}`);
		console.log(
			`[AI] 💬 Prompt: ${userMessage.slice(0, 200)}${userMessage.length > 200 ? "..." : ""}`,
		);

		// First, gather context with tools if available
		let toolCallLogs: ToolCallLog[] = [];
		let contextText = "";

		if (this.toolRegistry.size > 0) {
			console.log(`[AI] 🔍 Phase 1: Gathering codebase context...`);
			const contextResult = await this.run(
				systemPrompt +
					"\n\nExplore the codebase and summarize what you find relevant to the request.",
				userMessage,
			);
			toolCallLogs = contextResult.toolCalls;
			contextText = contextResult.output;
			console.log(
				`[AI] 📊 Context gathered: ${contextText.length} chars, ${toolCallLogs.length} tool calls`,
			);
		}

		// Now generate structured output using generateText with Output
		console.log(`[AI] 🔍 Phase 2: Generating structured output...`);
		const structuredPrompt = contextText
			? `Based on your codebase analysis:\n${contextText}\n\nNow respond to:\n${userMessage}`
			: userMessage;

		const structuredResponse = await generateText({
			model: openai(model),
			system: fullSystemPrompt,
			prompt: structuredPrompt,
			output: Output.object({ schema }),
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const responseAny = structuredResponse as any;

		console.log(
			`[AI] ✨ runWithSchema completed in ${Date.now() - startTime}ms`,
		);

		// The structured output location varies by SDK version
		// Try experimental_output first (newer), then object (older), then _output (internal)
		const output =
			responseAny.experimental_output ??
			responseAny.object ??
			responseAny._output ??
			responseAny.output;

		if (!output) {
			console.error(`[AI] ❌ No structured output found`);
			console.error(`[AI] 📦 Response keys:`, Object.keys(responseAny));
			console.error(`[AI] 📦 Response text:`, responseAny.text?.slice(0, 500));
			throw new Error("AI did not return structured output");
		}

		console.log(`[AI] ✅ Structured output received`);

		// Extract usage from totalUsage (aggregated) or usage
		const totalUsage = responseAny.totalUsage ?? responseAny.usage ?? {};
		const usage: TokenUsage = {
			promptTokens: totalUsage.promptTokens ?? 0,
			completionTokens: totalUsage.completionTokens ?? 0,
			totalTokens: 0,
		};
		usage.totalTokens = usage.promptTokens + usage.completionTokens;

		return {
			output: output as T,
			toolCalls: toolCallLogs,
			usage,
			durationMs: Date.now() - startTime,
			iterations: toolCallLogs.length > 0 ? toolCallLogs.length + 1 : 1,
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
