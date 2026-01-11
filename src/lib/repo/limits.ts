/**
 * Repository Adapter Limits & Constants
 *
 * These limits protect against:
 * - Token budget exhaustion (reading too much content)
 * - Memory issues (large files)
 * - Slow operations (deep traversal)
 */

/** Default patterns to ignore when traversing file tree */
export const DEFAULT_IGNORE = [
	// Dependencies
	"node_modules",
	"vendor",
	".pnpm",
	"bower_components",

	// Version control
	".git",
	".svn",
	".hg",

	// Build outputs
	"dist",
	"build",
	"out",
	".next",
	".nuxt",
	".output",
	"__pycache__",
	"*.pyc",
	".pytest_cache",
	"target", // Rust/Java

	// IDE & editors
	".idea",
	".vscode",
	"*.swp",
	"*.swo",
	".DS_Store",

	// Test & coverage
	"coverage",
	".nyc_output",
	"htmlcov",

	// Logs & temp
	"*.log",
	"logs",
	"tmp",
	"temp",
	".tmp",
	".temp",

	// Lock files (large, not useful for AI)
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"Cargo.lock",
	"poetry.lock",
	"Gemfile.lock",
	"composer.lock",

	// Environment & secrets
	".env",
	".env.*",
	"*.pem",
	"*.key",

	// Binary & media (can't read anyway)
	"*.png",
	"*.jpg",
	"*.jpeg",
	"*.gif",
	"*.ico",
	"*.svg",
	"*.woff",
	"*.woff2",
	"*.ttf",
	"*.eot",
	"*.mp3",
	"*.mp4",
	"*.webm",
	"*.pdf",
	"*.zip",
	"*.tar",
	"*.gz",
];

/** Size limits */
export const LIMITS = {
	/** Maximum file size to read (50KB) */
	MAX_FILE_SIZE: 50 * 1024,

	/** Maximum total content size per request (200KB) */
	MAX_TOTAL_SIZE: 200 * 1024,

	/** Maximum number of search results */
	MAX_SEARCH_RESULTS: 20,

	/** Maximum file tree depth */
	MAX_TREE_DEPTH: 6,

	/** Default file tree depth */
	DEFAULT_TREE_DEPTH: 4,

	/** Maximum number of files to return from glob */
	MAX_GLOB_RESULTS: 100,

	/** Maximum number of files to read at once */
	MAX_FILES_PER_READ: 10,

	/** Lines of context for search results */
	DEFAULT_SEARCH_CONTEXT: 2,
};

/**
 * Check if a path should be ignored based on patterns
 */
export function shouldIgnore(path: string, ignorePatterns: string[]): boolean {
	const segments = path.split(/[/\\]/);
	const fileName = segments[segments.length - 1];

	for (const pattern of ignorePatterns) {
		// Exact directory/file match
		if (segments.includes(pattern)) {
			return true;
		}

		// Glob-style matching for extensions
		if (pattern.startsWith("*.")) {
			const ext = pattern.slice(1); // ".json", ".log", etc.
			if (fileName.endsWith(ext)) {
				return true;
			}
		}

		// Prefix matching for patterns like ".env.*"
		if (pattern.endsWith(".*")) {
			const prefix = pattern.slice(0, -2);
			if (fileName.startsWith(`${prefix}.`)) {
				return true;
			}
		}
	}

	return false;
}
