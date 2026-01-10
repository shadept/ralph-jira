import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> }
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectContext(request);

		const run = await prisma.run.findFirst({
			where: {
				runId,
				projectId: project.id,
			},
			include: {
				sprint: { select: { name: true } },
				logs: {
					orderBy: { createdAt: "desc" },
					take: 100,
				},
			},
		});

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		const formattedRun = {
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
		};

		// Format logs
		const log = run.logs.map((l) => l.entry);

		return NextResponse.json({ run: formattedRun, log });
	} catch (error) {
		console.error("Failed to fetch run details", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> }
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectContext(request);
		const body = await request.json();

		// Verify run exists and belongs to project
		const existing = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
		});

		if (!existing) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		// Update run
		const updated = await prisma.run.update({
			where: { id: existing.id },
			data: {
				status: body.status ?? existing.status,
				reason: body.reason !== undefined ? body.reason : existing.reason,
				startedAt: body.startedAt
					? new Date(body.startedAt)
					: existing.startedAt,
				finishedAt: body.finishedAt
					? new Date(body.finishedAt)
					: existing.finishedAt,
				currentIteration: body.currentIteration ?? existing.currentIteration,
				lastTaskId:
					body.lastTaskId !== undefined
						? body.lastTaskId
						: existing.lastTaskId,
				lastMessage:
					body.lastMessage !== undefined
						? body.lastMessage
						: existing.lastMessage,
				lastCommand:
					body.lastCommand !== undefined
						? body.lastCommand
						: existing.lastCommand,
				lastCommandExitCode:
					body.lastCommandExitCode !== undefined
						? body.lastCommandExitCode
						: existing.lastCommandExitCode,
				errorsJson: body.errors
					? JSON.stringify(body.errors)
					: existing.errorsJson,
				lastProgressAt: body.lastProgressAt
					? new Date(body.lastProgressAt)
					: existing.lastProgressAt,
				pid: body.pid !== undefined ? body.pid : existing.pid,
				prUrl: body.prUrl !== undefined ? body.prUrl : existing.prUrl,
				cancellationRequestedAt: body.cancellationRequestedAt
					? new Date(body.cancellationRequestedAt)
					: existing.cancellationRequestedAt,
			},
			include: {
				sprint: { select: { name: true } },
			},
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
		console.error("Failed to update run", error);
		return handleProjectRouteError(error);
	}
}
