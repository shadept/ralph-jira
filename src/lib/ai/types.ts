/**
 * AI Client Types
 *
 * Shared types for the unified AI client.
 */

import type { JSONSchema7 } from "@ai-sdk/provider";
import type { RepoAdapter } from "../repo/types";

/**
 * Project context provided to AI for better understanding
 */
export interface ProjectContext {
	name: string;
	description: string;
	techStack: string[];
	conventions?: string;
	testingInfo?: string;
}

/**
 * Tool sets that can be enabled for the AI
 */
export type ToolSet = "repo" | "tasks" | "sprint";

/**
 * Configuration for creating an AI client
 */
export interface AIClientConfig {
	/** Model to use (e.g., "gpt-4-turbo", "claude-3-opus") */
	model?: string;

	/** Repository adapter for codebase access */
	repoAdapter?: RepoAdapter | null;

	/** Project context for prompts */
	projectContext?: ProjectContext;

	/** Which tool sets to enable (repo tools are auto-enabled if repoAdapter provided) */
	tools?: ToolSet[];

	/** Maximum tool call iterations (default: 20) */
	maxToolCalls?: number;

	/** Maximum tokens for response (optional) */
	maxTokens?: number;
}

/**
 * Log of a single tool call
 */
export interface ToolCallLog {
	/** Tool name */
	tool: string;

	/** Arguments passed to tool */
	args: Record<string, unknown>;

	/** Result returned from tool */
	result: unknown;

	/** Duration in milliseconds */
	durationMs: number;

	/** Whether the tool call succeeded */
	success: boolean;

	/** Error message if failed */
	error?: string;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * Result from an AI client run
 */
export interface AIResult<T = string> {
	/** The AI's output (text or structured data) */
	output: T;

	/** Log of all tool calls made */
	toolCalls: ToolCallLog[];

	/** Token usage statistics */
	usage: TokenUsage;

	/** Total duration in milliseconds */
	durationMs: number;

	/** Number of agentic iterations */
	iterations: number;
}

/**
 * Tool definition for function calling
 */
export interface ToolDefinition {
	/** Tool name (must be unique) */
	name: string;

	/** Description shown to the AI */
	description: string;

	/** JSON Schema for parameters */
	parameters: JSONSchema7;
}

/**
 * A tool with its definition and executor
 */
export interface Tool {
	definition: ToolDefinition;
	execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Message in the conversation
 */
export interface Message {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
}

/**
 * Tool call from the AI
 */
export interface ToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

/**
 * Response from the model
 */
export interface ModelResponse {
	content: string | null;
	toolCalls: ToolCall[];
	finishReason: "stop" | "tool_calls" | "length" | "content_filter";
	usage: TokenUsage;
}
