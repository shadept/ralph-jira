/**
 * Resolves the command to spawn the runner process based on executor mode.
 */
export function resolveRunnerCommand(params: {
	mode: "local" | "docker" | "cloud";
	projectPath: string;
	runId: string;
}) {
	const scriptArgs = ["tools/runner/run-loop.mjs", "--runId", params.runId];

	if (params.mode === "local") {
		scriptArgs.push("--projectPath", params.projectPath);
		return {
			command: "node",
			args: scriptArgs,
			cwd: params.projectPath,
		} as const;
	}

	if (params.mode === "docker") {
		scriptArgs.push("--projectPath", "/workspace");
		return {
			command: "docker",
			args: ["compose", "run", "--rm", "runner", "node", ...scriptArgs],
			cwd: params.projectPath,
		} as const;
	}

	// Cloud mode - placeholder for future implementation
	// For now, fall back to local mode
	scriptArgs.push("--projectPath", params.projectPath);
	return {
		command: "node",
		args: scriptArgs,
		cwd: params.projectPath,
	} as const;
}
