/**
 * Repository Tools for AI
 *
 * Provides tools for the AI to explore and read the codebase.
 */

import type { FileNode, RepoAdapter } from "../../repo/types";
import type { Tool, ToolDefinition } from "../types";

/**
 * Format a file tree for display to AI
 */
function formatFileTree(nodes: FileNode[], indent = ""): string {
	const lines: string[] = [];

	for (const node of nodes) {
		const prefix = node.type === "directory" ? "📁 " : "📄 ";
		lines.push(`${indent}${prefix}${node.name}`);

		if (node.children && node.children.length > 0) {
			lines.push(formatFileTree(node.children, `${indent}  `));
		}
	}

	return lines.join("\n");
}

/**
 * Create repository tools bound to a specific adapter
 */
export function createRepoTools(adapter: RepoAdapter): Tool[] {
	const getFileTreeTool: Tool = {
		definition: {
			name: "get_file_tree",
			description:
				"Get the project's file/folder structure. Call with a path to explore a specific directory deeper. Always call this first to understand the codebase layout.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description:
							"Directory to explore (default: project root). E.g., 'src/components' to see that subtree.",
					},
					maxDepth: {
						type: "number",
						description: "How many levels deep to show (default: 3, max: 6).",
					},
				},
			},
		},
		execute: async (args) => {
			const path = args.path as string | undefined;
			const maxDepth = args.maxDepth as number | undefined;

			const tree = await adapter.getFileTree({
				path,
				maxDepth: maxDepth ?? 3,
			});

			return {
				path: path || "/",
				tree: formatFileTree(tree),
				nodeCount: countNodes(tree),
			};
		},
	};

	const readFilesTool: Tool = {
		definition: {
			name: "read_files",
			description:
				"Read the contents of one or more files. Use when you need to understand implementation details. Maximum 10 files per call.",
			parameters: {
				type: "object",
				properties: {
					paths: {
						type: "array",
						items: { type: "string" },
						description:
							"File paths to read, e.g., ['src/lib/auth.ts', 'src/app/api/login/route.ts']",
					},
				},
				required: ["paths"],
			},
		},
		execute: async (args) => {
			const paths = args.paths as string[];

			if (!paths || paths.length === 0) {
				return { error: "No file paths provided" };
			}

			const contents = await adapter.readFiles(paths);

			return {
				files: contents.map((f) => ({
					path: f.path,
					content: f.content,
					truncated: f.truncated,
				})),
				filesRead: contents.length,
				filesRequested: paths.length,
			};
		},
	};

	const findFilesTool: Tool = {
		definition: {
			name: "find_files",
			description:
				"Find files matching a glob pattern. Use to locate relevant files before reading them.",
			parameters: {
				type: "object",
				properties: {
					pattern: {
						type: "string",
						description:
							"Glob pattern, e.g., 'src/**/*.test.ts', '**/auth*', '*.config.js'",
					},
				},
				required: ["pattern"],
			},
		},
		execute: async (args) => {
			const pattern = args.pattern as string;

			if (!pattern) {
				return { error: "No pattern provided" };
			}

			const matches = await adapter.glob(pattern);

			return {
				pattern,
				matches,
				count: matches.length,
			};
		},
	};

	const searchCodeTool: Tool = {
		definition: {
			name: "search_code",
			description:
				"Search for text/code patterns across files. Use to find where something is implemented or used.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"Text or regex to search for, e.g., 'useAuth', 'async function login', 'TODO:'",
					},
					filePattern: {
						type: "string",
						description:
							"Optional: limit search to files matching this glob, e.g., '*.ts', 'src/**/*.tsx'",
					},
				},
				required: ["query"],
			},
		},
		execute: async (args) => {
			const query = args.query as string;
			const filePattern = args.filePattern as string | undefined;

			if (!query) {
				return { error: "No search query provided" };
			}

			const matches = await adapter.search(query, {
				glob: filePattern,
				context: 2,
			});

			return {
				query,
				filePattern: filePattern || "*",
				matches: matches.map((m) => ({
					file: m.path,
					line: m.line,
					content: m.content,
					context: m.context,
				})),
				count: matches.length,
			};
		},
	};

	const fileExistsTool: Tool = {
		definition: {
			name: "file_exists",
			description: "Check if a file or directory exists at the given path.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Path to check, e.g., 'src/lib/auth.ts'",
					},
				},
				required: ["path"],
			},
		},
		execute: async (args) => {
			const path = args.path as string;

			if (!path) {
				return { error: "No path provided" };
			}

			const exists = await adapter.exists(path);

			return {
				path,
				exists,
			};
		},
	};

	return [
		getFileTreeTool,
		readFilesTool,
		findFilesTool,
		searchCodeTool,
		fileExistsTool,
	];
}

/**
 * Count total nodes in a file tree
 */
function countNodes(nodes: FileNode[]): number {
	let count = 0;
	for (const node of nodes) {
		count++;
		if (node.children) {
			count += countNodes(node.children);
		}
	}
	return count;
}

/**
 * Get tool definitions only (for sending to model)
 */
export function getRepoToolDefinitions(): ToolDefinition[] {
	// Return definitions without needing an adapter
	// Useful for showing available tools in UI
	return [
		{
			name: "get_file_tree",
			description:
				"Get the project's file/folder structure. Call with a path to explore a specific directory deeper.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Directory to explore (default: project root).",
					},
					maxDepth: {
						type: "number",
						description: "How many levels deep to show (default: 3).",
					},
				},
			},
		},
		{
			name: "read_files",
			description: "Read the contents of one or more files.",
			parameters: {
				type: "object",
				properties: {
					paths: {
						type: "array",
						items: { type: "string" },
						description: "File paths to read.",
					},
				},
				required: ["paths"],
			},
		},
		{
			name: "find_files",
			description: "Find files matching a glob pattern.",
			parameters: {
				type: "object",
				properties: {
					pattern: {
						type: "string",
						description: "Glob pattern to match.",
					},
				},
				required: ["pattern"],
			},
		},
		{
			name: "search_code",
			description: "Search for text/code patterns across files.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Text or regex to search for.",
					},
					filePattern: {
						type: "string",
						description: "Optional glob to limit search scope.",
					},
				},
				required: ["query"],
			},
		},
		{
			name: "file_exists",
			description: "Check if a file or directory exists.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Path to check.",
					},
				},
				required: ["path"],
			},
		},
	];
}
