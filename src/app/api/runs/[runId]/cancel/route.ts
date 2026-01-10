import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> }
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

		let lastMessage = "Cancellation requested...";
		let forceKilled = false;

		if (run.cancellationRequestedAt && run.pid) {
			try {
				// Second time requesting cancellation - kill the process
				process.kill(run.pid, "SIGTERM");
				lastMessage = "Process force killed.";
				forceKilled = true;
			} catch (err) {
				console.error(`Failed to kill process ${run.pid}`, err);
				lastMessage = "Process already dead or could not be killed.";
			}
		}

		const updated = await prisma.run.update({
			where: { id: run.id },
			data: {
				lastMessage,
				cancellationRequestedAt:
					run.cancellationRequestedAt || new Date(),
				status: "canceled",
				reason: "canceled",
				finishedAt: forceKilled ? new Date() : run.finishedAt,
			},
			include: { sprint: { select: { name: true } } },
		});

		const formattedRun = {
			runId: updated.runId,
			projectId: updated.projectId,
			sprintId: updated.sprintId,
			sprintName: updated.sprint.name,
			createdAt: updated.createdAt.toISOString(),
			startedAt: updated.startedAt?.toISOString() || null,
			finishedAt: updated.finishedAt?.toISOString() || null,
			status: updated.status,
			reason: updated.reason || undefined,
			sandboxPath: updated.sandboxPath,
			sandboxBranch: updated.sandboxBranch || undefined,
			maxIterations: updated.maxIterations,
			currentIteration: updated.currentIteration,
			executorMode: updated.executorMode,
			selectedTaskIds: JSON.parse(updated.selectedTaskIdsJson),
			lastTaskId: updated.lastTaskId || undefined,
			lastMessage: updated.lastMessage || undefined,
			lastCommand: updated.lastCommand || undefined,
			lastCommandExitCode: updated.lastCommandExitCode,
			errors: JSON.parse(updated.errorsJson),
			lastProgressAt: updated.lastProgressAt?.toISOString() || undefined,
			pid: updated.pid || undefined,
			prUrl: updated.prUrl || undefined,
			cancellationRequestedAt:
				updated.cancellationRequestedAt?.toISOString() || undefined,
			triggeredById: updated.triggeredById || undefined,
		};

		return NextResponse.json({ run: formattedRun });
	} catch (error) {
		console.error("Failed to cancel run", error);
		return handleProjectRouteError(error);
	}
}
