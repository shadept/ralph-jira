import { promises as fs } from "node:fs";
import path from "node:path";

const PENDING_STATUSES = new Set(["todo", "in_progress"]);
const MAX_LOG_SNIPPET = 1200;

/**
 * Detects if a path is a local filesystem path (not a remote URL).
 * @param {string} repoPath
 * @returns {boolean}
 */
function isLocalPath(repoPath) {
	if (!repoPath) return true;
	// Unix absolute paths, file:// URLs, or Windows paths like C:\
	if (
		repoPath.startsWith("/") ||
		repoPath.startsWith("file://") ||
		/^[A-Za-z]:[\\/]/.test(repoPath)
	) {
		return true;
	}
	// Remote URLs contain protocol or known hosts
	if (
		repoPath.includes("github.com") ||
		repoPath.includes("gitlab.com") ||
		repoPath.includes("bitbucket.org") ||
		repoPath.startsWith("http://") ||
		repoPath.startsWith("https://") ||
		repoPath.startsWith("git@")
	) {
		return false;
	}
	// Default to local for relative paths
	return true;
}

/**
 * Reads a JSON file and parses its content.
 * @param {string} filePath
 * @returns {Promise<any>}
 */
async function readJson(filePath) {
	const buffer = await fs.readFile(filePath, "utf-8");
	return JSON.parse(buffer);
}

/**
 * Writes a payload to a JSON file atomically using a temp file.
 * @param {string} filePath
 * @param {any} payload
 * @returns {Promise<void>}
 */
async function writeJson(filePath, payload) {
	const tmp = `${filePath}.tmp`;
	await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
	await fs.rename(tmp, filePath);
}

/**
 * Checks if a file exists at the given path.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Truncates a string to a maximum length for logging.
 * @param {string} output
 * @param {number} [maxLength]
 * @returns {string}
 */
function limitOutput(output, maxLength = MAX_LOG_SNIPPET) {
	if (!output) return "";
	if (output.length <= maxLength) return output.trim();
	return `${output.slice(0, maxLength)}\n...(output truncated)...`;
}

/**
 * Parses a command string into an array of arguments, respecting double quotes.
 * @param {string} command
 * @returns {string[]}
 */
function parseCommandString(command) {
	const parts = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === " " && !inQuotes) {
			if (current) parts.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	if (current) parts.push(current);
	return parts;
}

/**
 * @typedef {Object} WorkspaceConfig
 * @property {string} runId - The run ID.
 * @property {string} projectPath - The root project path.
 * @property {string} sandboxDir - The sandbox directory path.
 * @property {string} sandboxBoardPath - Path to the sandbox board JSON.
 * @property {string} sandboxLogPath - Path to the sandbox log file.
 * @property {string} sandboxSettingsPath - Path to the sandbox settings file.
 * @property {(command: string, args: string[], cwd: string, options?: object) => Promise<{stdout: string, stderr: string, code: number}>} runCommand - Function to execute shell commands.
 * @property {(text: string) => Promise<void>} appendLog - Function to append to the log.
 * @property {() => Promise<void>} markSandboxReady - Function to mark sandbox as ready.
 * @property {object} backend - The backend client for reading/writing data.
 * @property {object} settings - The current settings object.
 * @property {string} agentName - The agent name for PR descriptions.
 */

/**
 * Manages the workspace/sandbox for an autonomous coding agent run.
 * Handles worktree operations, git operations, and sandbox setup/cleanup.
 */
export class WorkspaceManager {
	/**
	 * @param {WorkspaceConfig} config
	 */
	constructor(config) {
		this.runId = config.runId;
		this.projectPath = config.projectPath;
		this.sandboxDir = config.sandboxDir;
		this.sandboxBoardPath = config.sandboxBoardPath;
		this.sandboxLogPath = config.sandboxLogPath;
		this.sandboxSettingsPath = config.sandboxSettingsPath;
		this.runCommand = config.runCommand;
		this.appendLog = config.appendLog;
		this.markSandboxReady = config.markSandboxReady;
		this.backend = config.backend;
		this.settings = config.settings;
		this.agentName = config.agentName || "claude";

		this.worktreeAdded = false;
		this.worktreeBranch = null;
		this.passed = 0;
		this.failed = 0;
	}

	/**
	 * Updates the settings reference.
	 * @param {object} settings
	 */
	setSettings(settings) {
		this.settings = settings;
	}

	/**
	 * Updates stats for PR descriptions.
	 * @param {number} passed
	 * @param {number} failed
	 */
	setStats(passed, failed) {
		this.passed = passed;
		this.failed = failed;
	}

	/**
	 * Sets the branch name for the worktree.
	 * @param {string} branchName
	 */
	setBranchName(branchName) {
		this.worktreeBranch = branchName;
	}

	/**
	 * Gets the branch name intended for the worktree.
	 * @returns {string}
	 */
	getEffectiveBranchName() {
		if (this.worktreeBranch?.trim().length) {
			return this.worktreeBranch.trim();
		}
		return `run-${this.runId}`;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Worktree Operations
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Ensures the parent directory for the sandbox exists.
	 * @returns {Promise<void>}
	 */
	async ensureSandboxParent() {
		await fs.mkdir(path.dirname(this.sandboxDir), { recursive: true });
	}

	/**
	 * Checks if a git branch exists.
	 * @param {string} branchName
	 * @returns {Promise<boolean>}
	 */
	async branchExists(branchName) {
		const result = await this.runCommand(
			"git",
			["rev-parse", "--verify", branchName],
			this.projectPath,
		);
		return result.code === 0;
	}

	/**
	 * Creates a git worktree for the sandbox.
	 * @returns {Promise<void>}
	 */
	async checkoutWorkspace() {
		console.log("[workspace-manager:checkoutWorkspace] Starting...");
		console.log(
			"[workspace-manager:checkoutWorkspace] sandboxDir:",
			this.sandboxDir,
		);
		console.log(
			"[workspace-manager:checkoutWorkspace] projectPath:",
			this.projectPath,
		);

		console.log(
			"[workspace-manager:checkoutWorkspace] Ensuring sandbox parent exists...",
		);
		await this.ensureSandboxParent();

		console.log(
			"[workspace-manager:checkoutWorkspace] Removing any existing worktree...",
		);
		await this.removeWorktree({ silent: true });

		const branchName = this.getEffectiveBranchName();
		console.log(
			"[workspace-manager:checkoutWorkspace] Branch name:",
			branchName,
		);
		this.worktreeBranch = branchName;

		const branchAlreadyExists = await this.branchExists(branchName);
		console.log(
			"[workspace-manager:checkoutWorkspace] Branch already exists:",
			branchAlreadyExists,
		);

		const args = branchAlreadyExists
			? ["worktree", "add", "--force", this.sandboxDir, branchName]
			: ["worktree", "add", "--force", "-b", branchName, this.sandboxDir];
		console.log(
			"[workspace-manager:checkoutWorkspace] Running git worktree add with args:",
			args.join(" "),
		);

		const result = await this.runCommand("git", args, this.projectPath);
		console.log(
			"[workspace-manager:checkoutWorkspace] git worktree add result code:",
			result.code,
		);
		if (result.code !== 0) {
			const snippet = limitOutput(result.stderr || result.stdout || "");
			console.error(
				"[workspace-manager:checkoutWorkspace] git worktree add failed:",
				snippet,
			);
			throw new Error(
				`git worktree add failed (code ${result.code}). ${snippet}`.trim(),
			);
		}
		this.worktreeAdded = true;
		console.log(
			"[workspace-manager:checkoutWorkspace] Worktree added successfully",
		);
		return branchName;
	}

	/**
	 * Removes the git worktree and deletes the sandbox directory.
	 * @param {object} [options]
	 * @param {boolean} [options.silent] - If true, suppresses error logging.
	 * @returns {Promise<void>}
	 */
	async removeWorktree(options = {}) {
		const { silent = false } = options;
		try {
			const result = await this.runCommand(
				"git",
				["worktree", "remove", "--force", this.sandboxDir],
				this.projectPath,
			);
			if (result.code !== 0 && !silent) {
				const snippet = limitOutput(result.stderr || result.stdout || "");
				console.warn(
					`git worktree remove failed (code ${result.code}). ${snippet}`.trim(),
				);
			}
		} catch (error) {
			if (!silent) {
				console.warn("Unable to execute git worktree remove", error);
			}
		}

		this.worktreeAdded = false;
		try {
			await fs.rm(this.sandboxDir, { recursive: true, force: true });
		} catch (error) {
			if (!silent && error.code !== "ENOENT") {
				console.warn("Unable to delete sandbox directory", error);
			}
		}

		this.worktreeBranch = null;
	}

	/**
	 * Executes sandbox cleanup if it is safe.
	 * @returns {Promise<void>}
	 */
	async cleanupSandbox() {
		if (!this.worktreeAdded && !(await fileExists(this.sandboxDir))) {
			return;
		}
		const safeToDelete = await this.ensureWorktreeSafeToDelete();
		if (!safeToDelete) {
			const branchName = this.getEffectiveBranchName();
			await this.appendLog(
				`Skipping sandbox cleanup for branch ${branchName} due to uncommitted or unpushed work. Push commits to origin before rerunning cleanup.\n`,
			);
			return;
		}
		await this.removeWorktree({ silent: false });
	}

	/**
	 * Verifies if the worktree has no uncommitted changes and no unpushed commits.
	 * @returns {Promise<boolean>}
	 */
	async ensureWorktreeSafeToDelete() {
		if (!this.worktreeAdded) {
			return true;
		}

		const branchName = this.getEffectiveBranchName();
		if (!branchName) {
			return true;
		}

		const statusResult = await this.runCommand(
			"git",
			["status", "--porcelain"],
			this.sandboxDir,
		);
		if (statusResult.code !== 0) {
			console.warn("Unable to inspect sandbox status before cleanup");
			return false;
		}
		if (statusResult.stdout.trim().length > 0) {
			console.warn(
				"Sandbox has uncommitted changes; leaving worktree in place.",
			);
			return false;
		}

		const remoteCheck = await this.runCommand(
			"git",
			["ls-remote", "--heads", "origin", branchName],
			this.projectPath,
		);
		if (remoteCheck.code !== 0 || !remoteCheck.stdout.trim()) {
			// Branch not on origin; keep local branch but safe to remove worktree if clean
			return true;
		}

		const fetchResult = await this.runCommand(
			"git",
			["fetch", "origin", branchName],
			this.projectPath,
		);
		if (fetchResult.code !== 0) {
			console.warn(
				`Unable to fetch origin/${branchName}. Leaving worktree for safety.`,
			);
			return false;
		}

		const aheadResult = await this.runCommand(
			"git",
			["rev-list", "--count", `origin/${branchName}..${branchName}`],
			this.projectPath,
		);
		if (aheadResult.code !== 0) {
			console.warn("Unable to determine push status for sandbox branch.");
			return false;
		}
		const ahead = parseInt(aheadResult.stdout.trim(), 10);
		if (Number.isNaN(ahead)) {
			console.warn("Unexpected response while checking push status.");
			return false;
		}
		if (ahead > 0) {
			console.warn(`Branch ${branchName} has ${ahead} unpushed commits.`);
			return false;
		}

		return true;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Git Operations
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Auto-commits any uncommitted changes to preserve work.
	 * @returns {Promise<boolean>} True if changes were committed
	 */
	async autoSaveUncommittedChanges() {
		if (!this.worktreeAdded) {
			return false;
		}

		const statusResult = await this.runCommand(
			"git",
			["status", "--porcelain"],
			this.sandboxDir,
		);
		if (statusResult.code !== 0) {
			await this.appendLog("Unable to check for uncommitted changes.\n");
			return false;
		}

		const hasChanges = statusResult.stdout.trim().length > 0;
		if (!hasChanges) {
			return false;
		}

		await this.appendLog("Found uncommitted changes. Auto-saving...\n");

		// Stage all changes
		const addResult = await this.runCommand(
			"git",
			["add", "-A"],
			this.sandboxDir,
		);
		if (addResult.code !== 0) {
			await this.appendLog(
				`Failed to stage changes: ${addResult.stderr || addResult.stdout}\n`,
			);
			return false;
		}

		// Commit with AUTO-SAVE marker
		const commitMessage = `[AUTO-SAVE] Uncommitted work from run ${this.runId}\n\nThis commit was automatically created to preserve work that was not committed by the agent.`;
		const commitResult = await this.runCommand(
			"git",
			["commit", "-m", commitMessage],
			this.sandboxDir,
		);
		if (commitResult.code !== 0) {
			await this.appendLog(
				`Failed to auto-save commit: ${commitResult.stderr || commitResult.stdout}\n`,
			);
			return false;
		}

		await this.appendLog("Successfully auto-saved uncommitted changes.\n");
		return true;
	}

	/**
	 * Checks if the worktree branch has any commits ahead of main.
	 * @returns {Promise<number>} Number of commits ahead of main
	 */
	async getCommitCount() {
		const branchName = this.getEffectiveBranchName();
		if (!branchName) return 0;

		const result = await this.runCommand(
			"git",
			["rev-list", "--count", `main..${branchName}`],
			this.sandboxDir,
		);
		if (result.code !== 0) {
			console.warn("Unable to determine commit count for branch");
			return -1;
		}
		const count = parseInt(result.stdout.trim(), 10);
		return Number.isNaN(count) ? -1 : count;
	}

	/**
	 * Pushes the worktree branch to origin.
	 * @returns {Promise<boolean>} True if push succeeded
	 */
	async pushBranch() {
		const branchName = this.getEffectiveBranchName();
		if (!branchName) return false;

		await this.appendLog(`Pushing branch ${branchName} to origin...\n`);
		const result = await this.runCommand(
			"git",
			["push", "-u", "origin", branchName],
			this.sandboxDir,
		);
		if (result.code !== 0) {
			const snippet = limitOutput(result.stderr || result.stdout || "");
			await this.appendLog(`Failed to push branch: ${snippet}\n`);
			return false;
		}
		await this.appendLog(
			`Successfully pushed branch ${branchName} to origin\n`,
		);
		return true;
	}

	/**
	 * Creates a pull request for the worktree branch using GitHub CLI.
	 * @returns {Promise<string|null>} PR URL if created, null otherwise
	 */
	async createPullRequest() {
		const branchName = this.getEffectiveBranchName();
		if (!branchName) return null;

		// Check if gh CLI is available
		try {
			const ghCheck = await this.runCommand(
				"gh",
				["--version"],
				this.sandboxDir,
			);
			if (ghCheck.code !== 0) {
				await this.appendLog(
					"GitHub CLI (gh) not available (exit code != 0). Skipping PR creation.\n",
				);
				return null;
			}

			// Check if authenticated
			const authCheck = await this.runCommand(
				"gh",
				["auth", "status"],
				this.sandboxDir,
			);
			if (authCheck.code !== 0) {
				await this.appendLog(
					"GitHub CLI not authenticated. Skipping PR creation.\n",
				);
				return null;
			}
		} catch (err) {
			await this.appendLog(
				`GitHub CLI check failed: ${err.message}. Skipping PR creation.\n`,
			);
			return null;
		}

		// Get board name for PR title
		const board = await readJson(this.sandboxBoardPath).catch(() => null);
		const boardName = board?.name || "AI Loop Run";
		const title = `[AI Loop] ${boardName}`;
		const body = [
			`## Summary`,
			`Automated PR from AI loop run \`${this.runId}\``,
			``,
			`**Branch:** ${branchName}`,
			`**Agent:** ${this.agentName}`,
			`**Passed:** ${this.passed}`,
			`**Failed:** ${this.failed}`,
			``,
			`---`,
			`🤖 Generated by ralph-jira AI loop`,
		].join("\n");

		await this.appendLog(`Creating pull request for branch ${branchName}...\n`);
		try {
			const result = await this.runCommand(
				"gh",
				[
					"pr",
					"create",
					"--title",
					title,
					"--body",
					body,
					"--base",
					"main",
					"--head",
					branchName,
				],
				this.sandboxDir,
			);

			if (result.code !== 0) {
				// Check if PR already exists
				if (
					result.stderr?.includes("already exists") ||
					result.stdout?.includes("already exists")
				) {
					await this.appendLog("Pull request already exists for this branch\n");
					// Try to get existing PR URL
					const viewResult = await this.runCommand(
						"gh",
						["pr", "view", branchName, "--json", "url", "-q", ".url"],
						this.sandboxDir,
					);
					if (viewResult.code === 0 && viewResult.stdout.trim()) {
						return viewResult.stdout.trim();
					}
					return null;
				}
				const snippet = limitOutput(result.stderr || result.stdout || "");
				await this.appendLog(`Failed to create PR: ${snippet}\n`);
				return null;
			}

			const prUrl = result.stdout.trim();
			await this.appendLog(`Created pull request: ${prUrl}\n`);
			return prUrl;
		} catch (err) {
			await this.appendLog(`Unable to create PR: ${err.message}\n`);
			return null;
		}
	}

	/**
	 * Deletes the local worktree branch.
	 * @returns {Promise<boolean>} True if deletion succeeded
	 */
	async deleteLocalBranch() {
		const branchName = this.getEffectiveBranchName();
		if (!branchName) return false;

		const result = await this.runCommand(
			"git",
			["branch", "-D", branchName],
			this.projectPath,
		);
		if (result.code !== 0) {
			const snippet = limitOutput(result.stderr || result.stdout || "");
			await this.appendLog(`Failed to delete local branch: ${snippet}\n`);
			return false;
		}
		await this.appendLog(`Deleted local branch ${branchName}\n`);
		return true;
	}

	/**
	 * Deletes the remote worktree branch.
	 * @returns {Promise<boolean>} True if deletion succeeded
	 */
	async deleteRemoteBranch() {
		const branchName = this.getEffectiveBranchName();
		if (!branchName) return false;

		const result = await this.runCommand(
			"git",
			["push", "origin", "--delete", branchName],
			this.projectPath,
		);
		if (result.code !== 0) {
			// Branch might not exist on remote - that's ok
			return false;
		}
		await this.appendLog(`Deleted remote branch origin/${branchName}\n`);
		return true;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Sandbox Setup
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Prepares the sandbox plan by filtering the PRD tasks and copying settings.
	 * @param {string} boardId - The board ID to load.
	 * @returns {Promise<void>}
	 */
	async prepareSandboxPlan(boardId) {
		console.log(
			"[workspace-manager:prepareSandboxPlan] Starting for boardId:",
			boardId,
		);

		// Always write filtered board to sandbox (worktree has main branch version)
		console.log(
			"[workspace-manager:prepareSandboxPlan] Reading board from backend...",
		);
		const board = await this.backend.readBoard(boardId);
		console.log(
			"[workspace-manager:prepareSandboxPlan] Board loaded, tasks count:",
			board?.tasks?.length || 0,
		);

		const filteredTasks = board.tasks.filter((task) =>
			PENDING_STATUSES.has(task.status),
		);
		console.log(
			"[workspace-manager:prepareSandboxPlan] Filtered to pending tasks:",
			filteredTasks.length,
		);

		const sandboxBoard = { ...board, tasks: filteredTasks };
		console.log(
			"[workspace-manager:prepareSandboxPlan] Creating plans directory...",
		);
		await fs.mkdir(path.dirname(this.sandboxBoardPath), { recursive: true });

		console.log(
			"[workspace-manager:prepareSandboxPlan] Writing sandbox board to:",
			this.sandboxBoardPath,
		);
		await writeJson(this.sandboxBoardPath, sandboxBoard);

		// Always write settings to sandbox
		console.log(
			"[workspace-manager:prepareSandboxPlan] Creating settings directory...",
		);
		await fs.mkdir(path.dirname(this.sandboxSettingsPath), { recursive: true });

		console.log(
			"[workspace-manager:prepareSandboxPlan] Writing settings to:",
			this.sandboxSettingsPath,
		);
		await writeJson(this.sandboxSettingsPath, this.settings);

		if (!(await fileExists(this.sandboxLogPath))) {
			console.log(
				"[workspace-manager:prepareSandboxPlan] Creating new log file:",
				this.sandboxLogPath,
			);
			await fs.writeFile(
				this.sandboxLogPath,
				`# Run ${this.runId} progress\n`,
				"utf-8",
			);
		} else {
			console.log(
				"[workspace-manager:prepareSandboxPlan] Appending to existing log file",
			);
			await fs.appendFile(
				this.sandboxLogPath,
				`\n# Run ${this.runId} resumed\n`,
				"utf-8",
			);
		}

		// Sandbox log is now ready
		console.log(
			"[workspace-manager:prepareSandboxPlan] Marking sandbox as ready...",
		);
		await this.markSandboxReady();

		// Decouple PRD, settings, and logs from git tracking in the sandbox to avoid conflicts
		console.log(
			"[workspace-manager:prepareSandboxPlan] Decoupling files from git tracking...",
		);
		await this.runCommand(
			"git",
			["update-index", "--skip-worktree", "plans/prd.json"],
			this.sandboxDir,
		);
		await this.runCommand(
			"git",
			["update-index", "--skip-worktree", "plans/settings.json"],
			this.sandboxDir,
		);
		await this.runCommand(
			"git",
			["update-index", "--skip-worktree", "progress.txt"],
			this.sandboxDir,
		);
		console.log("[workspace-manager:prepareSandboxPlan] Complete");
	}

	/**
	 * Runs the configured setup commands in the sandbox.
	 * @param {string[]} setupCommands - Array of setup commands to run.
	 * @param {() => Promise<boolean>} checkCancellation - Function to check for cancellation.
	 * @returns {Promise<void>}
	 */
	async runSetup(setupCommands, checkCancellation) {
		if (!setupCommands.length) {
			await this.appendLog(
				"No setup commands configured. Skipping setup step.\n",
			);
			return;
		}
		for (const command of setupCommands) {
			await this.appendLog(`Running setup command: ${command}\n`);

			const parts = parseCommandString(command);
			const [cmd, ...args] = parts;
			if (!cmd) continue;

			const result = await this.runCommand(cmd, args, this.sandboxDir, {
				shell: true,
				timeout: 120000,
			});
			await this.appendLog(`${limitOutput(result.stdout || result.stderr)}\n`);
			if (await checkCancellation()) {
				throw new Error("Cancellation during setup");
			}
			if (result.code !== 0) {
				throw new Error(`Setup command failed: ${command}`);
			}
		}
	}

	/**
	 * Reads the sandbox board JSON.
	 * @returns {Promise<object|null>}
	 */
	async readSandboxBoard() {
		try {
			return await readJson(this.sandboxBoardPath);
		} catch {
			return null;
		}
	}

	/**
	 * Copies sandbox logs to the persisted run log location.
	 * @param {string} persistedLogPath - The destination path for the log.
	 * @returns {Promise<void>}
	 */
	async copyLogs(persistedLogPath) {
		await fs.mkdir(path.dirname(persistedLogPath), { recursive: true });
		await fs.copyFile(this.sandboxLogPath, persistedLogPath);
	}

	/**
	 * Updates internal stats based on the final state of the sandbox board.
	 * @returns {Promise<{passed: number, failed: number}>}
	 */
	async captureSandboxStats() {
		try {
			const board = await readJson(this.sandboxBoardPath);
			this.passed = board.tasks.filter((task) => task.passes === true).length;
			this.failed = board.tasks.filter((task) => task.passes !== true).length;
		} catch (error) {
			console.warn("Unable to compute sandbox stats", error.message || error);
		}
		return { passed: this.passed, failed: this.failed };
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Finalization
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Performs finalization: auto-save, push, PR creation, and conditional cleanup.
	 * @param {object} [options]
	 * @param {boolean} [options.syncSuccess] - Whether PRD sync to root succeeded.
	 * @returns {Promise<{prUrl: string|null, cleanedUp: boolean, worktreePreserved: boolean}>}
	 */
	async finalize(options = {}) {
		const { syncSuccess = true } = options;
		const branchName = this.getEffectiveBranchName();
		const isLocal = isLocalPath(this.projectPath);
		let prUrl = null;
		let cleanedUp = false;
		let worktreePreserved = false;

		// Auto-save any uncommitted changes to preserve work
		try {
			await this.autoSaveUncommittedChanges();
		} catch (saveError) {
			console.error("Failed to auto-save uncommitted changes", saveError);
			await this.appendLog(
				`Warning: Could not auto-save uncommitted changes: ${saveError.message}\n`,
			);
		}

		// Check if branch has any commits
		const commitCount = await this.getCommitCount();

		if (commitCount === 0) {
			// No commits on branch - safe to delete
			await this.appendLog(
				`Branch ${branchName} has no commits. Cleaning up.\n`,
			);
			try {
				await this.removeWorktree({ silent: false });
				await this.deleteLocalBranch();
				cleanedUp = true;
			} catch (cleanupError) {
				console.warn("Unable to clean up empty branch", cleanupError);
			}
		} else if (commitCount > 0) {
			// Local repo: skip push (worktree is connected to original repo)
			if (isLocal) {
				await this.appendLog(
					`Local repo detected - skipping push (worktree connected to original)\n`,
				);

				// If sync failed, preserve worktree for manual recovery
				if (!syncSuccess) {
					await this.appendLog(
						`Sync failed - preserving worktree for manual recovery\n`,
					);
					await this.appendLog(`Worktree: ${this.sandboxDir}\n`);
					await this.appendLog(`Branch: ${branchName}\n`);
					worktreePreserved = true;
				} else {
					// Sync succeeded - safe to clean up worktree (commits are on branch)
					try {
						await this.cleanupSandbox();
						cleanedUp = true;
					} catch (cleanupError) {
						console.warn("Unable to clean up sandbox workspace", cleanupError);
					}
				}
			} else {
				// Remote repo: push and create PR
				const pushSuccess = await this.pushBranch();
				if (pushSuccess) {
					prUrl = await this.createPullRequest();
					// Push succeeded - safe to clean up worktree
					try {
						await this.cleanupSandbox();
						cleanedUp = true;
					} catch (cleanupError) {
						console.warn("Unable to clean up sandbox workspace", cleanupError);
					}
				} else {
					// Push failed - leave worktree for human review
					await this.appendLog(
						`Push failed. Leaving worktree at ${this.sandboxDir} for human review.\n`,
					);
					await this.appendLog(
						`To clean up manually: git worktree remove ${this.sandboxDir}\n`,
					);
					worktreePreserved = true;
				}
			}
		} else {
			// Error determining commit count - leave worktree for manual review
			await this.appendLog(
				`Could not determine commit status for ${branchName}. Leaving worktree in place.\n`,
			);
			worktreePreserved = true;
		}

		return { prUrl, cleanedUp, worktreePreserved };
	}
}
