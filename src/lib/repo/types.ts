/**
 * Repository Adapter Types
 *
 * Abstracts file access across different backends:
 * - Local filesystem
 * - GitHub API
 * - GitLab API (future)
 * - Sandboxed environments (future)
 */

export interface FileNode {
	/** Full path relative to repo root, e.g. "src/components/Button.tsx" */
	path: string;
	/** File or directory name, e.g. "Button.tsx" */
	name: string;
	/** Whether this is a file or directory */
	type: "file" | "directory";
	/** File size in bytes (files only) */
	size?: number;
	/** Children nodes (directories only) */
	children?: FileNode[];
}

export interface SearchMatch {
	/** File path where match was found */
	path: string;
	/** Line number (1-indexed) */
	line: number;
	/** The matching line content */
	content: string;
	/** Surrounding context lines */
	context?: {
		before: string[];
		after: string[];
	};
}

export interface FileContent {
	/** File path */
	path: string;
	/** File content as string */
	content: string;
	/** Whether content was truncated due to size limit */
	truncated?: boolean;
}

export interface GetFileTreeOptions {
	/** Starting path relative to repo root (default: root) */
	path?: string;
	/** Maximum depth to traverse (default: 4) */
	maxDepth?: number;
	/** Patterns to ignore (default: node_modules, .git, etc.) */
	ignore?: string[];
}

export interface ReadFileOptions {
	/** Maximum bytes to read (default: 100KB) */
	maxSize?: number;
}

export interface GlobOptions {
	/** Patterns to ignore */
	ignore?: string[];
	/** Maximum results to return (default: 100) */
	maxResults?: number;
}

export interface SearchOptions {
	/** Limit search to files matching this glob pattern */
	glob?: string;
	/** Maximum results to return (default: 20) */
	maxResults?: number;
	/** Lines of context to include before/after match (default: 0) */
	context?: number;
}

/**
 * Repository Adapter Interface
 *
 * All methods work with paths relative to the repository root.
 * Implementations must handle security (path traversal, symlinks, etc.)
 */
export interface RepoAdapter {
	/**
	 * Get the file tree structure
	 */
	getFileTree(options?: GetFileTreeOptions): Promise<FileNode[]>;

	/**
	 * Read a single file's contents
	 * @returns File content or null if not found
	 */
	readFile(
		path: string,
		options?: ReadFileOptions,
	): Promise<FileContent | null>;

	/**
	 * Read multiple files at once
	 * @returns Array of file contents (missing files omitted)
	 */
	readFiles(paths: string[], options?: ReadFileOptions): Promise<FileContent[]>;

	/**
	 * Find files matching a glob pattern
	 */
	glob(pattern: string, options?: GlobOptions): Promise<string[]>;

	/**
	 * Search file contents (like grep)
	 */
	search(pattern: string, options?: SearchOptions): Promise<SearchMatch[]>;

	/**
	 * Check if a path exists
	 */
	exists(path: string): Promise<boolean>;
}

/**
 * Adapter type detected from repo URL
 */
export type AdapterType =
	| "local"
	| "github"
	| "gitlab"
	| "bitbucket"
	| "sandbox";

/**
 * Configuration for creating a repo adapter
 */
export interface RepoConfig {
	type: AdapterType;
	/** Local filesystem path */
	localPath?: string;
	/** GitHub configuration */
	github?: {
		owner: string;
		repo: string;
		branch?: string;
		installationId: number;
	};
	/** GitLab configuration (future) */
	gitlab?: {
		owner: string;
		repo: string;
		branch?: string;
		token: string;
	};
}
