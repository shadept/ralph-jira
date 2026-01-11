/**
 * Local Filesystem Repository Adapter
 *
 * Provides file access for local git repositories.
 * Includes security measures against path traversal attacks.
 * Respects .gitignore patterns in addition to DEFAULT_IGNORE.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import ignore, { type Ignore } from "ignore";

import { DEFAULT_IGNORE, LIMITS, shouldIgnore } from "../limits";
import type {
	FileContent,
	FileNode,
	GetFileTreeOptions,
	GlobOptions,
	ReadFileOptions,
	RepoAdapter,
	SearchMatch,
	SearchOptions,
} from "../types";

export class LocalRepoAdapter implements RepoAdapter {
	private repoPath: string;
	private gitignore: Ignore | null = null;
	private gitignoreLoaded = false;

	constructor(repoPath: string) {
		// Normalize and resolve to absolute path
		this.repoPath = path.resolve(repoPath);
	}

	/**
	 * Load and parse .gitignore file
	 */
	private async loadGitignore(): Promise<Ignore> {
		if (this.gitignoreLoaded) {
			return this.gitignore ?? ignore();
		}

		this.gitignoreLoaded = true;

		try {
			const gitignorePath = path.join(this.repoPath, ".gitignore");
			const content = await fs.readFile(gitignorePath, "utf-8");
			this.gitignore = ignore().add(content);
		} catch {
			// No .gitignore or can't read it - that's fine
			this.gitignore = ignore();
		}

		return this.gitignore;
	}

	/**
	 * Check if a path should be ignored (combines .gitignore + DEFAULT_IGNORE)
	 */
	private async isIgnored(
		relativePath: string,
		extraIgnore: string[],
	): Promise<boolean> {
		// Check DEFAULT_IGNORE and any extra patterns
		if (shouldIgnore(relativePath, [...DEFAULT_IGNORE, ...extraIgnore])) {
			return true;
		}

		// Check .gitignore
		const gi = await this.loadGitignore();
		return gi.ignores(relativePath);
	}

	/**
	 * Resolve a relative path to absolute, ensuring it stays within repo
	 * @throws Error if path traversal detected
	 */
	private resolvePath(relativePath: string): string {
		// Normalize the path to handle .. and .
		const normalized = path.normalize(relativePath);

		// Prevent absolute paths being passed in
		if (path.isAbsolute(normalized)) {
			throw new Error("Absolute paths not allowed");
		}

		// Resolve against repo root
		const resolved = path.resolve(this.repoPath, normalized);

		// Security: ensure resolved path is within repoPath
		if (
			!resolved.startsWith(this.repoPath + path.sep) &&
			resolved !== this.repoPath
		) {
			throw new Error("Path traversal detected");
		}

		return resolved;
	}

	/**
	 * Convert absolute path to relative (for output)
	 */
	private toRelativePath(absolutePath: string): string {
		return path.relative(this.repoPath, absolutePath);
	}

	async getFileTree(options?: GetFileTreeOptions): Promise<FileNode[]> {
		const startPath = options?.path
			? this.resolvePath(options.path)
			: this.repoPath;
		const maxDepth = Math.min(
			options?.maxDepth ?? LIMITS.DEFAULT_TREE_DEPTH,
			LIMITS.MAX_TREE_DEPTH,
		);
		const extraIgnore = options?.ignore ?? [];

		// Preload gitignore
		await this.loadGitignore();

		return this.buildTree(startPath, 0, maxDepth, extraIgnore);
	}

	private async buildTree(
		currentPath: string,
		depth: number,
		maxDepth: number,
		extraIgnore: string[],
	): Promise<FileNode[]> {
		if (depth >= maxDepth) {
			return [];
		}

		const entries = await fs.readdir(currentPath, { withFileTypes: true });
		const nodes: FileNode[] = [];

		for (const entry of entries) {
			const relativePath = this.toRelativePath(
				path.join(currentPath, entry.name),
			);

			// Check ignore patterns (DEFAULT_IGNORE + .gitignore + extra)
			if (await this.isIgnored(relativePath, extraIgnore)) {
				continue;
			}

			if (entry.isDirectory()) {
				const children = await this.buildTree(
					path.join(currentPath, entry.name),
					depth + 1,
					maxDepth,
					extraIgnore,
				);

				nodes.push({
					path: relativePath,
					name: entry.name,
					type: "directory",
					children,
				});
			} else if (entry.isFile()) {
				try {
					const stats = await fs.stat(path.join(currentPath, entry.name));
					nodes.push({
						path: relativePath,
						name: entry.name,
						type: "file",
						size: stats.size,
					});
				} catch {
					// Skip files we can't stat
				}
			}
			// Skip symlinks, sockets, etc. for security
		}

		// Sort: directories first, then files, alphabetically
		nodes.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === "directory" ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return nodes;
	}

	async readFile(
		filePath: string,
		options?: ReadFileOptions,
	): Promise<FileContent | null> {
		const absolutePath = this.resolvePath(filePath);
		const maxSize = options?.maxSize ?? LIMITS.MAX_FILE_SIZE;

		try {
			const stats = await fs.stat(absolutePath);

			if (!stats.isFile()) {
				return null;
			}

			// Check file size
			if (stats.size > maxSize) {
				// Read only up to maxSize
				const handle = await fs.open(absolutePath, "r");
				try {
					const buffer = Buffer.alloc(maxSize);
					await handle.read(buffer, 0, maxSize, 0);
					return {
						path: filePath,
						content: buffer.toString("utf-8"),
						truncated: true,
					};
				} finally {
					await handle.close();
				}
			}

			const content = await fs.readFile(absolutePath, "utf-8");
			return {
				path: filePath,
				content,
				truncated: false,
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return null;
			}
			throw error;
		}
	}

	async readFiles(
		paths: string[],
		options?: ReadFileOptions,
	): Promise<FileContent[]> {
		// Limit number of files
		const limitedPaths = paths.slice(0, LIMITS.MAX_FILES_PER_READ);
		const results: FileContent[] = [];
		let totalSize = 0;

		for (const filePath of limitedPaths) {
			// Stop if we've read too much content
			if (totalSize >= LIMITS.MAX_TOTAL_SIZE) {
				break;
			}

			const content = await this.readFile(filePath, options);
			if (content) {
				totalSize += content.content.length;
				results.push(content);
			}
		}

		return results;
	}

	async glob(pattern: string, options?: GlobOptions): Promise<string[]> {
		const extraIgnore = options?.ignore ?? [];
		const maxResults = options?.maxResults ?? LIMITS.MAX_GLOB_RESULTS;

		// Combine DEFAULT_IGNORE with extra patterns for glob exclude
		const allIgnorePatterns = [...DEFAULT_IGNORE, ...extraIgnore];
		const excludePatterns = allIgnorePatterns.map((p) => {
			if (p.startsWith("*.")) {
				return `**/${p}`;
			}
			return `**/${p}/**`;
		});

		// Load gitignore for filtering
		const gi = await this.loadGitignore();

		// Use Node 24's native fs.glob
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fsGlob = (fs as any).glob as (
			pattern: string,
			options: {
				cwd: string;
				exclude?: string[] | ((name: string) => boolean);
			},
		) => AsyncIterable<string>;

		const matches: string[] = [];
		for await (const entry of fsGlob(pattern, {
			cwd: this.repoPath,
			exclude: (name: string) =>
				excludePatterns.some((p) => {
					// Simple pattern matching
					if (p.includes("**")) {
						const regex = new RegExp(
							p.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"),
						);
						return regex.test(name);
					}
					return name.includes(p);
				}),
		})) {
			// Skip directories
			const fullPath = path.join(this.repoPath, entry);
			try {
				const stat = await fs.stat(fullPath);
				if (stat.isFile() && !gi.ignores(entry)) {
					matches.push(entry);
					if (matches.length >= maxResults) break;
				}
			} catch {
				// Skip files we can't stat
			}
		}

		return matches;
	}

	async search(
		pattern: string,
		options?: SearchOptions,
	): Promise<SearchMatch[]> {
		const maxResults = options?.maxResults ?? LIMITS.MAX_SEARCH_RESULTS;
		const contextLines = options?.context ?? LIMITS.DEFAULT_SEARCH_CONTEXT;

		// Get files to search
		const filePattern = options?.glob ?? "**/*";
		const files = await this.glob(filePattern, {
			maxResults: 500, // Search more files, but limit matches
		});

		const matches: SearchMatch[] = [];
		const regex = new RegExp(pattern, "gi");

		for (const file of files) {
			if (matches.length >= maxResults) {
				break;
			}

			const content = await this.readFile(file);
			if (!content) continue;

			const lines = content.content.split("\n");

			for (let i = 0; i < lines.length; i++) {
				if (matches.length >= maxResults) {
					break;
				}

				if (regex.test(lines[i])) {
					const match: SearchMatch = {
						path: file,
						line: i + 1, // 1-indexed
						content: lines[i],
					};

					if (contextLines > 0) {
						match.context = {
							before: lines.slice(Math.max(0, i - contextLines), i),
							after: lines.slice(i + 1, i + 1 + contextLines),
						};
					}

					matches.push(match);
				}

				// Reset regex lastIndex for global flag
				regex.lastIndex = 0;
			}
		}

		return matches;
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			const absolutePath = this.resolvePath(filePath);
			await fs.access(absolutePath);
			return true;
		} catch {
			return false;
		}
	}
}
