import crypto from "node:crypto";
import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";
import { Board } from "@/lib/schemas";
import {
	createInitialRunRecord,
	defaultMaxIterations,
	resolveRunnerCommand,
	upsertRun,
	writeRun,
} from "@/lib/runs/store";

const PRIORITY_STATUSES = new Set(["in_progress", "todo"]);
const DEFAULT_SPRINT_ID = "prd";

function selectTaskIds(board: Board) {
	return board.tasks
		.filter((task) => PRIORITY_STATUSES.has(task.status))
		.map((task) => task.id);
}

function resolveSprintId(board: Board, requestedId?: string) {
	if (requestedId && requestedId !== "prd") return requestedId;
	return board.id;
}

interface RunRequestPayload {
	boardId?: string;
	sprintId?: string;
	maxIterations?: number;
	branchName?: string;
}

function normalizeBranchName(value?: string) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function isValidBranchName(name: string) {
	if (!name) return false;
	if (/\s/.test(name)) return false;
	if (name.includes("..")) return false;
	if (name.startsWith("/") || name.endsWith("/") || name.endsWith(".lock"))
		return false;
	if (
		name.includes("~") ||
		name.includes("^") ||
		name.includes(":") ||
		name.includes("?") ||
		name.includes("*") ||
		name.includes("[")
	) {
		return false;
	}
	return /^[A-Za-z0-9._\/-]+$/.test(name);
}

export async function POST(request: Request) {
	try {
		const payload: RunRequestPayload = await request.json().catch(() => ({}));
		// Support both boardId (legacy) and sprintId
		const requestedSprintId =
			payload.sprintId || payload.boardId || DEFAULT_SPRINT_ID;
		const branchName = normalizeBranchName(payload.branchName);
		if (!isValidBranchName(branchName)) {
			return NextResponse.json(
				{
					error:
						"branchName is required and may only include letters, numbers, ., -, _, and / (no spaces).",
				},
				{ status: 400 },
			);
		}
		const { project, storage } = await getProjectStorage(request);

		const board = await storage.readBoard(requestedSprintId);
		const settings = await storage.readSettings();
		const maxIterations =
			payload.maxIterations ||
			defaultMaxIterations(settings.automation?.maxIterations, 5);
		const runId = `run-${crypto.randomUUID()}`;
		const executorMode =
			process.env.RUN_LOOP_EXECUTOR === "docker" ? "docker" : "local";

		const runRecord = createInitialRunRecord({
			runId,
			projectId: project.id,
			sprintId: resolveSprintId(board, requestedSprintId),
			sprintName: board.name,
			selectedTaskIds: selectTaskIds(board),
			maxIterations,
			executorMode,
			sandboxBranch: branchName,
		});

		await writeRun(project.path, runRecord);

		const { command, args, cwd } = resolveRunnerCommand({
			mode: executorMode,
			projectPath: project.path,
			runId,
		});

		let child: ReturnType<typeof spawn>;
		try {
			console.log("Starting run process", command, args);
			child = spawn(command, args, {
				cwd,
				detached: true,
				stdio: "ignore",
				env: { ...process.env },
				windowsHide: true,
			});
			child.unref();
		} catch (spawnError) {
			await upsertRun(project.path, runRecord, {
				status: "failed",
				reason: "error",
				errors: [...runRecord.errors, `Runner spawn failed: ${spawnError}`],
				lastMessage: "Failed to spawn runner process",
			});
			throw spawnError;
		}

		const runWithPid = await upsertRun(project.path, runRecord, {
			pid: child.pid ?? undefined,
		});

		return NextResponse.json({ run: runWithPid });
	} catch (error) {
		console.error("Failed to start AI loop run", error);
		return handleProjectRouteError(error);
	}
}
