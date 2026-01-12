import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * @typedef {Object} AgentOptions
 * @property {string} name - The name of the agent.
 * @property {string} bin - The binary name or path to execute the agent.
 * @property {string} [model] - The model identifier for the agent.
 * @property {string[]} [extraArgs] - Additional command line arguments.
 * @property {string} [codingStyle] - Instructions regarding preferred coding style.
 * @property {string} [permissionMode] - (Claude specific) The permission mode for edits.
 */

/**
 * @typedef {Object} RunContext
 * @property {string} sandboxDir - The directory where the agent should run.
 * @property {(command: string, args: string[], cwd: string, options?: object) => Promise<{stdout: string, stderr: string, code: number}>} runCommand - Function to execute shell commands.
 * @property {(commandRecord: object) => Promise<void>} addCommand - Function to add a command record to the run's command list.
 * @property {(text: string) => Promise<void>} appendSandboxLog - Function to append to the iteration log.
 * @property {() => Promise<void>} flushSandboxLog - Function to flush remaining log buffer.
 * @property {(data: object) => Promise<any>} updateRun - Function to update run state.
 * @property {() => Promise<void>} checkCancellation - Function to check for cancellation. Throws if canceled.
 * @property {number} iteration - The current iteration number.
 */

/**
 * Base class for all coding agents.
 */
export class Agent {
	/**
	 * @param {AgentOptions} options
	 */
	constructor(options) {
		this.name = options.name;
		this.bin = options.bin;
		this.model = options.model;
		this.extraArgs = options.extraArgs || [];
		this.codingStyle = options.codingStyle || "";
	}

	/**
	 * Executes an iteration of the agent.
	 * @param {RunContext} context
	 * @returns {Promise<{ output: string, exitCode: number }>}
	 */
	async run(_context) {
		throw new Error("Method not implemented");
	}
}

/**
 * Agent implementation for Anthropic's Claude CLI.
 */
export class ClaudeAgent extends Agent {
	/**
	 * @param {AgentOptions} options
	 */
	constructor(options) {
		super(options);
		this.permissionMode = options.permissionMode || "bypassPermissions";
	}

	/**
	 * @param {RunContext} context
	 * @returns {Promise<{ output: string, exitCode: number }>}
	 */
	async run({
		sandboxDir,
		addCommand,
		appendSandboxLog,
		flushSandboxLog,
		checkCancellation,
		iteration,
	}) {
		const promptLines = [
			"@plans/prd.json @progress.txt",
			"1. Find the highest-priority feature to work on and work only on that feature.",
			"This should be the one YOU decide has the highest priority - not necessarily the first in the list.",
			"2. Check that the types check via npm typecheck and that the tests pass via npm test.",
			"3. Update the PRD with the work that was done (never mark status as `done`, prefer `review`).",
			"4. Append your process to the progress.txt file.",
			"Use this to leave a note for the next person working in the codebase.",
			"5. make a git commit of the feature.",
			"ONLY WORK ON A SINGLE FEATURE.",
			"If, while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>",
		];

		let prompt = promptLines.join("\n");
		if (this.codingStyle) {
			prompt += `\n\n<coding-style>\n${this.codingStyle}\n</coding-style>`;
		}

		const startedAt = new Date().toISOString();
		const commandRecord = {
			command: "claude-agent-sdk",
			args: [`query (iteration ${iteration})`],
			cwd: sandboxDir,
			startedAt,
		};

		await appendSandboxLog(
			`\n[${startedAt}] Starting claude iteration ${iteration}\n`,
		);

		await addCommand(commandRecord);

		let fullContent = "";
		try {
			const options = {
				tools: { type: "preset", preset: "claude_code" },
				permissionMode: this.permissionMode,
				model: this.model || undefined,
				cwd: sandboxDir,
				// Explicitly allow all tools to avoid permission prompts
				allowedTools: [
					"Bash",
					"Read",
					"Write",
					"Edit",
					"Glob",
					"Grep",
					"Task",
					"TodoWrite",
					"WebFetch",
					"WebSearch",
				],
			};
			// bypassPermissions requires allowDangerouslySkipPermissions flag
			if (this.permissionMode === "bypassPermissions") {
				options.allowDangerouslySkipPermissions = true;
			}

			for await (const message of query({ prompt, options })) {
				await checkCancellation();
				if (message.type === "assistant" && message.message?.content) {
					for (const block of message.message.content) {
						if ("text" in block) {
							await appendSandboxLog(block.text);
							fullContent += block.text;
						} else if ("name" in block) {
							// Cyan for tool names
							let details = "";
							if (block.input && typeof block.input === "object") {
								// Filter out verbose params for certain commands
								const verboseParams = {
									Edit: ["old_string", "new_string"],
									Write: ["content"],
									Grep: ["pattern"],
									Task: ["prompt"],
									Bash: ["command"],
								};
								const skipKeys = verboseParams[block.name] || [];

								// Truncate long values
								const truncate = (v, max = 60) => {
									const s = typeof v === "string" ? v : JSON.stringify(v);
									return s.length > max ? `${s.slice(0, max)}...` : s;
								};

								// Convert absolute paths to relative
								const toRelative = (v) => {
									if (typeof v === "string" && path.isAbsolute(v)) {
										return path.relative(sandboxDir, v) || ".";
									}
									return v;
								};

								details = Object.entries(block.input)
									.filter(([k]) => !skipKeys.includes(k))
									.map(([k, v]) => `${k}=${truncate(toRelative(v))}`)
									.join(" ");
							}
							// Add newline before tool call for readability
							await appendSandboxLog(
								`\n\x1b[36m| ${block.name}${details ? ` ${details}` : ""}\x1b[0m`,
							);
						}
					}
				} else if (message.type === "result") {
					// Green for results
					await appendSandboxLog(
						`\x1b[32m[Result] ${message.subtype}\x1b[0m\n`,
					);
				} else if (message.type === "error") {
					// Red for errors in the stream
					await appendSandboxLog(
						`\x1b[31m[Stream Error] ${message.message}\x1b[0m\n`,
					);
					fullContent += `\n[Stream Error] ${message.message}\n`;
				}
			}
		} catch (error) {
			if (
				error.name === "CancellationSignal" ||
				error.message?.includes("Run canceled by user")
			) {
				commandRecord.exitCode = -1;
				commandRecord.finishedAt = new Date().toISOString();
				throw error;
			}
			const usageLimitRegex =
				/usage limit|Rate Exceeded|Too Many Requests|429|out of extra usage|resets \d+(am|pm)/i;
			const isUsageLimit =
				usageLimitRegex.test(error.message || "") ||
				usageLimitRegex.test(fullContent);
			const exitCode = isUsageLimit ? 2 : 1;
			// Red for errors
			await appendSandboxLog(`\x1b[31m[Error] ${error.message}\x1b[0m\n`);
			await flushSandboxLog();
			commandRecord.exitCode = exitCode;
			commandRecord.finishedAt = new Date().toISOString();
			await addCommand(commandRecord);
			return { output: fullContent, exitCode };
		}

		await flushSandboxLog();
		commandRecord.exitCode = 0;
		commandRecord.finishedAt = new Date().toISOString();
		await addCommand(commandRecord);
		return { output: fullContent, exitCode: 0 };
	}
}

/**
 * Agent implementation for OpenCode.
 */
export class OpenCodeAgent extends Agent {
	/**
	 * @param {RunContext} context
	 * @returns {Promise<{ output: string, exitCode: number }>}
	 */
	async run({ sandboxDir, runCommand, appendSandboxLog, iteration }) {
		const basePrompt = `READ all of @plans/prd.json. Pick ONE task. Verify via web/code search. Complete task, verify via CLI/Test output. Commit change. ONLY do one task. Update @plans/prd.json. If you learn a critical operational detail (e.g. how to build), update AGENTS.md. If all tasks done, sleep 5s and exit. NEVER GIT PUSH. ONLY COMMIT.`;

		const prompt = this.codingStyle
			? `${basePrompt}\n\n<coding-style>\n${this.codingStyle}\n</coding-style>`
			: basePrompt;

		const args = ["run"];

		if (!args.includes("--model") && this.model) {
			args.push("--model", this.model);
		}

		args.push(...this.extraArgs, prompt);

		const describeInvocation = () => {
			return `${this.bin} ${args.map((a) => (a === prompt ? "[prompt omitted]" : a)).join(" ")}`.trim();
		};

		await appendSandboxLog([
			`Running opencode (iteration ${iteration})`,
			`Command: ${describeInvocation()}`,
		]);

		// Using shell: false to avoid parsing issues.
		const result = await runCommand(this.bin, args, sandboxDir, {
			timeout: 1800000,
		});
		const combinedOutput =
			`${result.stdout}${result.stderr ? `\n${result.stderr}` : ""}`.trim();

		return { output: combinedOutput, exitCode: result.code ?? 0 };
	}
}

/**
 * Factory function to create an agent by name.
 * @param {string} name - The type of agent to create ('claude' or 'opencode').
 * @param {AgentOptions} options - Configuration for the agent.
 * @returns {Agent}
 */
export function createAgent(name, options) {
	const normalizedName = name.toLowerCase();
	switch (normalizedName) {
		case "claude":
			return new ClaudeAgent(options);
		case "opencode":
			return new OpenCodeAgent(options);
		default:
			throw new Error(
				`Unsupported RUN_LOOP_AGENT "${name}". Set RUN_LOOP_AGENT to "claude" or "opencode".`,
			);
	}
}
