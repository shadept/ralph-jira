import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

function formatTask(task: {
	id: string;
	projectId: string;
	sprintId: string | null;
	category: string;
	title: string | null;
	description: string;
	acceptanceCriteriaJson: string;
	status: string;
	priority: string;
	passes: boolean;
	estimate: number | null;
	deadline: Date | null;
	tagsJson: string;
	filesTouchedJson: string;
	assigneeId: string | null;
	createdById: string | null;
	lastRun: Date | null;
	failureNotes: string | null;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
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
	};
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string; taskId: string }> }
) {
	try {
		const { id, taskId } = await params;
		const { project } = await getProjectContextFromParams(id);

		const task = await prisma.task.findFirst({
			where: {
				id: taskId,
				projectId: project.id,
			},
		});

		if (!task) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 });
		}

		return NextResponse.json({ task: formatTask(task) });
	} catch (error) {
		console.error("Error fetching task:", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string; taskId: string }> }
) {
	try {
		const { id, taskId } = await params;
		const { project } = await getProjectContextFromParams(id);
		const body = await request.json();

		// Verify task exists and belongs to project
		const existingTask = await prisma.task.findFirst({
			where: {
				id: taskId,
				projectId: project.id,
			},
		});

		if (!existingTask) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 });
		}

		const task = await prisma.task.update({
			where: { id: taskId },
			data: {
				sprintId: body.sprintId !== undefined ? body.sprintId : undefined,
				category: body.category !== undefined ? body.category : undefined,
				title: body.title !== undefined ? body.title : undefined,
				description:
					body.description !== undefined ? body.description : undefined,
				acceptanceCriteriaJson:
					body.acceptanceCriteria !== undefined
						? JSON.stringify(body.acceptanceCriteria)
						: undefined,
				status: body.status !== undefined ? body.status : undefined,
				priority: body.priority !== undefined ? body.priority : undefined,
				passes: body.passes !== undefined ? body.passes : undefined,
				estimate: body.estimate !== undefined ? body.estimate : undefined,
				deadline:
					body.deadline !== undefined
						? body.deadline
							? new Date(body.deadline)
							: null
						: undefined,
				tagsJson:
					body.tags !== undefined ? JSON.stringify(body.tags) : undefined,
				filesTouchedJson:
					body.filesTouched !== undefined
						? JSON.stringify(body.filesTouched)
						: undefined,
				assigneeId:
					body.assigneeId !== undefined ? body.assigneeId : undefined,
				failureNotes:
					body.failureNotes !== undefined ? body.failureNotes : undefined,
			},
		});

		return NextResponse.json({ task: formatTask(task) });
	} catch (error) {
		console.error("Error updating task:", error);
		return handleProjectRouteError(error);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string; taskId: string }> }
) {
	try {
		const { id, taskId } = await params;
		const { project } = await getProjectContextFromParams(id);

		// Verify task exists and belongs to project
		const existingTask = await prisma.task.findFirst({
			where: {
				id: taskId,
				projectId: project.id,
			},
		});

		if (!existingTask) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 });
		}

		await prisma.task.delete({
			where: { id: taskId },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting task:", error);
		return handleProjectRouteError(error);
	}
}
