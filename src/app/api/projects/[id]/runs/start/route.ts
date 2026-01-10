import crypto from "node:crypto";
import { spawn } from "node:child_process";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";
import { resolveRunnerCommand } from "@/lib/runs/store";

const PRIORITY_STATUSES = new Set(["in_progress", "todo"]);

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

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const payload: RunRequestPayload = await request.json().catch(() => ({}));
		const { project, userId } = await getProjectContextFromParams(id);

		const requestedSprintId = payload.sprintId || payload.boardId;

		const branchName = normalizeBranchName(payload.branchName);
		if (!isValidBranchName(branchName)) {
			return NextResponse.json(
				{
					error:
						"branchName is required and may only include letters, numbers, ., -, _, and / (no spaces).",
				},
				{ status: 400 }
			);
		}

		let sprint;
		if (requestedSprintId) {
			sprint = await prisma.sprint.findFirst({
				where: {
					id: requestedSprintId,
					projectId: project.id,
					archivedAt: null,
				},
				include: { tasks: true },
			});
		} else {
			sprint = await prisma.sprint.findFirst({
				where: {
					projectId: project.id,
					archivedAt: null,
				},
				include: { tasks: true },
				orderBy: { createdAt: "desc" },
			});
		}

		if (!sprint) {
			return NextResponse.json(
				{ error: "No sprint found for this project" },
				{ status: 404 }
			);
		}

		const settings = await prisma.projectSettings.findUnique({
			where: { projectId: project.id },
		});

		const automationSettings = settings?.automationJson
			? JSON.parse(settings.automationJson)
			: null;
		const maxIterations =
			payload.maxIterations || automationSettings?.maxIterations || 5;

		const runId = `run-${crypto.randomUUID()}`;
		const executorMode =
			process.env.RUN_LOOP_EXECUTOR === "docker" ? "docker" : "local";

		const selectedTaskIds = sprint.tasks
			.filter((task) => PRIORITY_STATUSES.has(task.status))
			.map((task) => task.id);

		const sandboxPath = project.repoUrl || process.cwd();

		const run = await prisma.run.create({
			data: {
				runId,
				projectId: project.id,
				sprintId: sprint.id,
				status: "queued",
				maxIterations,
				currentIteration: 0,
				executorMode,
				sandboxPath,
				sandboxBranch: branchName,
				selectedTaskIdsJson: JSON.stringify(selectedTaskIds),
				errorsJson: "[]",
				triggeredById: userId,
			},
			include: { sprint: { select: { name: true } } },
		});

		const { command, args, cwd } = resolveRunnerCommand({
			mode: executorMode,
			projectPath: sandboxPath,
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
			await prisma.run.update({
				where: { id: run.id },
				data: {
					status: "failed",
					reason: "error",
					errorsJson: JSON.stringify([`Runner spawn failed: ${spawnError}`]),
					lastMessage: "Failed to spawn runner process",
				},
			});
			throw spawnError;
		}

		const updatedRun = await prisma.run.update({
			where: { id: run.id },
			data: { pid: child.pid ?? null },
			include: { sprint: { select: { name: true } } },
		});

		const formattedRun = {
			runId: updatedRun.runId,
			projectId: updatedRun.projectId,
			sprintId: updatedRun.sprintId,
			sprintName: updatedRun.sprint.name,
			createdAt: updatedRun.createdAt.toISOString(),
			startedAt: updatedRun.startedAt?.toISOString() || null,
			finishedAt: updatedRun.finishedAt?.toISOString() || null,
			status: updatedRun.status,
			sandboxPath: updatedRun.sandboxPath,
			sandboxBranch: updatedRun.sandboxBranch || undefined,
			maxIterations: updatedRun.maxIterations,
			currentIteration: updatedRun.currentIteration,
			executorMode: updatedRun.executorMode,
			selectedTaskIds: JSON.parse(updatedRun.selectedTaskIdsJson),
			pid: updatedRun.pid || undefined,
			errors: [],
		};

		return NextResponse.json({ run: formattedRun });
	} catch (error) {
		console.error("Failed to start AI loop run", error);
		return handleProjectRouteError(error);
	}
}
