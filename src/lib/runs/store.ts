import { promises as fs } from "node:fs";
import path from "node:path";

import { RunRecord, RunRecordSchema } from "@/lib/schemas";

const RUNS_SUBDIR = path.join("plans", "runs");
const SANDBOX_SUBDIR = path.join(".pm", "sandboxes");
const PROGRESS_FILE = "progress.txt";

async function ensureDir(target: string) {
	await fs.mkdir(target, { recursive: true });
}

async function atomicWrite(filePath: string, payload: unknown) {
	const tmpPath = `${filePath}.tmp`;
	await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
	await fs.rename(tmpPath, filePath);
}

function runsDir(projectPath: string) {
	return path.join(projectPath, RUNS_SUBDIR);
}

export function sandboxRoot(projectPath: string) {
	return path.join(projectPath, SANDBOX_SUBDIR);
}

export function sandboxPath(projectPath: string, runId: string) {
	return path.join(sandboxRoot(projectPath), runId);
}

export function relativeSandboxPath(runId: string) {
	return path.join(SANDBOX_SUBDIR, runId);
}

export function runFilePath(projectPath: string, runId: string) {
	return path.join(runsDir(projectPath), `${runId}.json`);
}

export function cancelFlagRelative(runId: string) {
	return path.join(RUNS_SUBDIR, `${runId}.cancel`);
}

export function cancelFlagPath(projectPath: string, runId: string) {
	return path.join(runsDir(projectPath), `${runId}.cancel`);
}

export function runLogRelative(runId: string) {
	return path.join(RUNS_SUBDIR, `${runId}.progress.txt`);
}

export function runLogPath(projectPath: string, runId: string) {
	return path.join(runsDir(projectPath), `${runId}.progress.txt`);
}

export async function ensureRunArtifacts(projectPath: string) {
	await Promise.all([
		ensureDir(runsDir(projectPath)),
		ensureDir(sandboxRoot(projectPath)),
	]);
}

export async function readRun(
	projectPath: string,
	runId: string,
): Promise<RunRecord> {
	const buffer = await fs.readFile(runFilePath(projectPath, runId), "utf-8");
	return RunRecordSchema.parse(JSON.parse(buffer));
}

export async function writeRun(
	projectPath: string,
	run: RunRecord,
): Promise<void> {
	await ensureRunArtifacts(projectPath);
	const payload = RunRecordSchema.parse(run);
	await atomicWrite(runFilePath(projectPath, run.runId), payload);
}

export async function listRuns(projectPath: string): Promise<RunRecord[]> {
	await ensureRunArtifacts(projectPath);
	const files = await fs.readdir(runsDir(projectPath));
	const runFiles = files.filter((file) => file.endsWith(".json"));
	const runs: RunRecord[] = [];

	for (const file of runFiles) {
		try {
			const buffer = await fs.readFile(
				path.join(runsDir(projectPath), file),
				"utf-8",
			);
			const parsed = RunRecordSchema.parse(JSON.parse(buffer));
			runs.push(parsed);
		} catch (error) {
			console.warn(`Unable to parse run file ${file}`, error);
		}
	}

	return runs.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}

export async function appendProgress(projectPath: string, entry: string) {
	const filePath = path.join(projectPath, PROGRESS_FILE);
	const timestamp = new Date().toISOString();
	const block = `\n[${timestamp}]\n${entry.trim()}\n`;
	await fs.appendFile(filePath, block, { encoding: "utf-8" });
}

export async function tailLog(
	filePath: string,
	maxLines = 100,
): Promise<string[]> {
	try {
		const content = await fs.readFile(filePath, "utf-8");
		const trimmed = content.trim();
		if (!trimmed) return [];
		const lines = trimmed.split(/\r?\n/);
		return lines.slice(-maxLines);
	} catch (error) {
		return [];
	}
}

export async function appendRunLog(
	projectPath: string,
	runId: string,
	entry: string,
): Promise<void> {
	const logPath = runLogPath(projectPath, runId);
	await ensureRunArtifacts(projectPath);
	const timestamp = new Date().toISOString();
	const block = `[${timestamp}] ${entry}`;
	await fs.appendFile(logPath, block, { encoding: "utf-8" });
}

export async function getRunLogs(
	projectPath: string,
	runId: string,
	limit = 100,
): Promise<string[]> {
	const logPath = runLogPath(projectPath, runId);
	return tailLog(logPath, limit);
}

export function defaultMaxIterations(settingsMax?: number, fallback = 5) {
	if (!settingsMax || settingsMax <= 0) return fallback;
	return settingsMax;
}

export function boardSourcePathFromId(boardId: string) {
	if (
		boardId === "prd" ||
		boardId === "active" ||
		boardId === "initial-sprint"
	) {
		return path.join("plans", "prd.json");
	}
	return path.join("plans", `${boardId}.json`);
}

export function createInitialRunRecord(params: {
	runId: string;
	projectId: string;
	sprintId: string;
	sprintName?: string;
	selectedTaskIds: string[];
	maxIterations: number;
	executorMode: "local" | "docker" | "cloud";
	sandboxBranch?: string;
}): RunRecord {
	const now = new Date().toISOString();
	const relativeSandbox = relativeSandboxPath(params.runId);
	const run: RunRecord = {
		runId: params.runId,
		projectId: params.projectId,
		sprintId: params.sprintId,
		sprintName: params.sprintName,
		createdAt: now,
		startedAt: null,
		finishedAt: null,
		status: "queued",
		reason: undefined,
		sandboxPath: relativeSandbox,
		sandboxBranch: params.sandboxBranch,
		maxIterations: params.maxIterations,
		currentIteration: 0,
		selectedTaskIds: params.selectedTaskIds,
		lastTaskId: undefined,
		lastMessage: undefined,
		lastCommand: undefined,
		lastCommandExitCode: undefined,
		errors: [],
		lastProgressAt: undefined,
		executorMode: params.executorMode,
		pid: undefined,
		commands: [],
		cancellationRequestedAt: undefined,
	};

	return RunRecordSchema.parse(run);
}

export async function upsertRun(
	projectPath: string,
	run: RunRecord,
	patch: Partial<RunRecord>,
) {
	const updated: RunRecord = { ...run, ...patch };
	await writeRun(projectPath, updated);
	return updated;
}

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
