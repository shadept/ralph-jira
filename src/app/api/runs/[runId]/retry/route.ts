import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { createRunnerToken } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";
import { resolveRunnerCommand } from "@/lib/runs/runner-command";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project, userId } = await getProjectContext(request);

		const run = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
			include: { sprint: { select: { name: true, id: true } } },
		});

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		// Only allow retry if it's in a terminal state
		const terminalStatuses = ["completed", "failed", "stopped", "canceled"];
		if (!terminalStatuses.includes(run.status)) {
			return NextResponse.json(
				{ error: `Cannot retry a run in status: ${run.status}` },
				{ status: 400 },
			);
		}

		// Reset run state for retry
		const updatedRun = await prisma.run.update({
			where: { id: run.id },
			data: {
				status: "queued",
				startedAt: null,
				finishedAt: null,
				reason: null,
				lastMessage: "Retrying run...",
				errorsJson: "[]",
				cancellationRequestedAt: null,
			},
			include: { sprint: { select: { name: true } } },
		});

		const executorMode = (run.executorMode ||
			(process.env.RUN_LOOP_EXECUTOR === "docker" ? "docker" : "local")) as
			| "local"
			| "docker"
			| "cloud";

		// Use the project's repoUrl as the path for local runs
		const projectPath = project.repoUrl || process.cwd();

		// Wrap runner startup in try-catch to mark run as failed on any error
		let child: ReturnType<typeof spawn>;
		let logFd: number | null = null;

		try {
			const { command, args, cwd } = resolveRunnerCommand({
				mode: executorMode,
				projectPath,
				runId,
			});

			// Delete any existing auth token for this run (from previous attempts)
			await prisma.authToken.deleteMany({
				where: { runId },
			});

			// Generate new runner token for API authentication
			const authToken = await createRunnerToken(
				userId,
				project.id,
				run.sprint.id,
				runId,
			);

			// Create log file for runner stdout/stderr
			const logsDir = path.join(projectPath, "plans", "runs");
			fs.mkdirSync(logsDir, { recursive: true });
			const logFilePath = path.join(logsDir, `${runId}.runner.log`);
			logFd = fs.openSync(logFilePath, "a");

			console.log("Retrying run process", command, args);
			console.log("Runner log file:", logFilePath);
			console.log("Project ID for runner:", project.id);

			child = spawn(command, args, {
				cwd,
				detached: true,
				stdio: ["ignore", logFd, logFd],
				env: {
					...process.env,
					RUN_LOOP_PROJECT_ID: project.id,
					RUN_LOOP_AUTH_TOKEN: authToken,
				},
				windowsHide: true,
			});
			child.unref();

			// Close the file descriptor in the parent process
			fs.closeSync(logFd);
			logFd = null;
		} catch (startupError) {
			// Close file descriptor if open
			if (logFd !== null) {
				try {
					fs.closeSync(logFd);
				} catch {}
			}

			// Mark run as failed
			await prisma.run.update({
				where: { id: run.id },
				data: {
					status: "failed",
					reason: "error",
					errorsJson: JSON.stringify([
						`Runner startup failed: ${startupError instanceof Error ? startupError.message : startupError}`,
					]),
					lastMessage: "Failed to start runner process",
				},
			});
			throw startupError;
		}

		await prisma.run.update({
			where: { id: run.id },
			data: { pid: child.pid ?? null },
		});

		console.log("Runner process started with PID:", child.pid);

		const formattedRun = {
			runId: updatedRun.runId,
			projectId: updatedRun.projectId,
			sprintId: updatedRun.sprintId,
			sprintName: updatedRun.sprint.name,
			createdAt: updatedRun.createdAt.toISOString(),
			startedAt: updatedRun.startedAt?.toISOString() || null,
			finishedAt: updatedRun.finishedAt?.toISOString() || null,
			status: updatedRun.status,
			reason: updatedRun.reason || undefined,
			sandboxPath: updatedRun.sandboxPath,
			sandboxBranch: updatedRun.sandboxBranch || undefined,
			maxIterations: updatedRun.maxIterations,
			currentIteration: updatedRun.currentIteration,
			executorMode: updatedRun.executorMode,
			selectedTaskIds: JSON.parse(updatedRun.selectedTaskIdsJson),
			lastMessage: updatedRun.lastMessage || undefined,
			errors: JSON.parse(updatedRun.errorsJson),
		};

		return NextResponse.json({ run: formattedRun });
	} catch (error) {
		console.error("Failed to retry run", error);
		return handleProjectRouteError(error);
	}
}
