import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
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
		const { project } = await getProjectContext(request);

		const run = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
			include: { sprint: { select: { name: true } } },
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

		const { command, args, cwd } = resolveRunnerCommand({
			mode: executorMode,
			projectPath,
			runId,
		});

		console.log("Retrying run process", command, args);
		const child = spawn(command, args, {
			cwd,
			detached: true,
			stdio: "ignore",
			env: { ...process.env },
			windowsHide: true,
		});
		child.unref();

		await prisma.run.update({
			where: { id: run.id },
			data: { pid: child.pid ?? null },
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
