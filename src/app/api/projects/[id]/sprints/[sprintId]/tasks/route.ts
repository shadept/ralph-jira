import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string; sprintId: string }> },
) {
	try {
		const { id, sprintId } = await params;
		const { project } = await getProjectContextFromParams(id);

		const sprint = await prisma.sprint.findFirst({
			where: { id: sprintId, projectId: project.id },
		});

		if (!sprint) {
			return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
		}

		const tasks = await prisma.task.findMany({
			where: { sprintId },
			orderBy: { createdAt: "asc" },
		});

		const formattedTasks = tasks.map((task) => ({
			id: task.id,
			projectId: task.projectId,
			sprintId: task.sprintId,
			category: task.category,
			title: task.title,
			description: task.description,
			acceptanceCriteria: JSON.parse(task.acceptanceCriteriaJson),
			status: task.status,
			priority: task.priority,
			passes: task.passes,
			estimate: task.estimate,
			deadline: task.deadline?.toISOString() || null,
			tags: JSON.parse(task.tagsJson),
			filesTouched: JSON.parse(task.filesTouchedJson),
			assigneeId: task.assigneeId,
			createdById: task.createdById,
			lastRun: task.lastRun?.toISOString() || null,
			failureNotes: task.failureNotes,
			createdAt: task.createdAt.toISOString(),
			updatedAt: task.updatedAt.toISOString(),
		}));

		return NextResponse.json({ tasks: formattedTasks });
	} catch (error) {
		console.error("Error fetching sprint tasks:", error);
		return handleProjectRouteError(error);
	}
}
