import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id);

		const runs = await prisma.run.findMany({
			where: { projectId: project.id },
			include: {
				sprint: {
					select: { name: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		const formattedRuns = runs.map((run) => ({
			runId: run.runId,
			projectId: run.projectId,
			sprintId: run.sprintId,
			sprintName: run.sprint.name,
			createdAt: run.createdAt.toISOString(),
			startedAt: run.startedAt?.toISOString() || null,
			finishedAt: run.finishedAt?.toISOString() || null,
			status: run.status,
			reason: run.reason || undefined,
			sandboxPath: run.sandboxPath,
			sandboxBranch: run.sandboxBranch || undefined,
			maxIterations: run.maxIterations,
			currentIteration: run.currentIteration,
			executorMode: run.executorMode,
			selectedTaskIds: JSON.parse(run.selectedTaskIdsJson),
			lastTaskId: run.lastTaskId || undefined,
			lastMessage: run.lastMessage || undefined,
			lastCommand: run.lastCommand || undefined,
			lastCommandExitCode: run.lastCommandExitCode,
			errors: JSON.parse(run.errorsJson),
			lastProgressAt: run.lastProgressAt?.toISOString() || undefined,
			pid: run.pid || undefined,
			prUrl: run.prUrl || undefined,
			cancellationRequestedAt:
				run.cancellationRequestedAt?.toISOString() || undefined,
			triggeredById: run.triggeredById || undefined,
		}));

		return NextResponse.json({ runs: formattedRuns });
	} catch (error) {
		console.error("Failed to list runs", error);
		return handleProjectRouteError(error);
	}
}
