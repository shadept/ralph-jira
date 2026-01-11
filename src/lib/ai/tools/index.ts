/**
 * AI Tools Registry
 *
 * Manages tool registration and execution for the AI client.
 */

import type { RepoAdapter } from "../../repo/types";
import type { Tool, ToolDefinition, ToolSet } from "../types";
import { createRepoTools } from "./repo";

export { createRepoTools, getRepoToolDefinitions } from "./repo";

/**
 * Tool registry for managing available tools
 */
export class ToolRegistry {
	private tools: Map<string, Tool> = new Map();

	/**
	 * Register a single tool
	 */
	register(tool: Tool): void {
		if (this.tools.has(tool.definition.name)) {
			throw new Error(`Tool already registered: ${tool.definition.name}`);
		}
		this.tools.set(tool.definition.name, tool);
	}

	/**
	 * Register multiple tools
	 */
	registerAll(tools: Tool[]): void {
		for (const tool of tools) {
			this.register(tool);
		}
	}

	/**
	 * Get a tool by name
	 */
	get(name: string): Tool | undefined {
		return this.tools.get(name);
	}

	/**
	 * Get all tool definitions (for sending to model)
	 */
	getDefinitions(): ToolDefinition[] {
		return Array.from(this.tools.values()).map((t) => t.definition);
	}

	/**
	 * Execute a tool by name
	 */
	async execute(
		name: string,
		args: Record<string, unknown>,
	): Promise<{ result: unknown; success: boolean; error?: string }> {
		const tool = this.tools.get(name);

		if (!tool) {
			return {
				result: null,
				success: false,
				error: `Unknown tool: ${name}`,
			};
		}

		try {
			const result = await tool.execute(args);
			return { result, success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				result: null,
				success: false,
				error: message,
			};
		}
	}

	/**
	 * Check if a tool is registered
	 */
	has(name: string): boolean {
		return this.tools.has(name);
	}

	/**
	 * Get number of registered tools
	 */
	get size(): number {
		return this.tools.size;
	}

	/**
	 * Get all tool names
	 */
	getNames(): string[] {
		return Array.from(this.tools.keys());
	}
}

/**
 * Create a tool registry with tools based on configuration
 */
export function createToolRegistry(config: {
	repoAdapter?: RepoAdapter | null;
	toolSets?: ToolSet[];
}): ToolRegistry {
	const registry = new ToolRegistry();

	// Repo tools are auto-enabled if adapter provided
	if (config.repoAdapter) {
		registry.registerAll(createRepoTools(config.repoAdapter));
	}

	// Additional tool sets based on config
	const toolSets = config.toolSets ?? [];

	if (toolSets.includes("tasks")) {
		// TODO: Add task tools (create, update, estimate)
		// registry.registerAll(createTaskTools());
	}

	if (toolSets.includes("sprint")) {
		// TODO: Add sprint tools (prioritize, split)
		// registry.registerAll(createSprintTools());
	}

	return registry;
}

/**
 * Format tool definitions for OpenAI function calling
 */
export function formatToolsForOpenAI(definitions: ToolDefinition[]): Array<{
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: ToolDefinition["parameters"];
	};
}> {
	return definitions.map((def) => ({
		type: "function" as const,
		function: {
			name: def.name,
			description: def.description,
			parameters: def.parameters,
		},
	}));
}
