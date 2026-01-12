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
	title: string;
	description: string | null;
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

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string; sprintId: string }> },
) {
	try {
		const { id, sprintId } = await params;
		const { project } = await getProjectContextFromParams(id, request);
		const body = await request.json();

		// Verify sprint exists and belongs to project
		const sprint = await prisma.sprint.findFirst({
			where: { id: sprintId, projectId: project.id },
		});

		if (!sprint) {
			return NextResponse.json(
				{ error: "Sprint not found", code: "SPRINT_NOT_FOUND" },
				{ status: 404 },
			);
		}

		// Validate required fields
		if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
			return NextResponse.json(
				{ error: "Title is required", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		const task = await prisma.task.create({
			data: {
				projectId: project.id,
				sprintId,
				title: body.title.trim(),
				description: body.description || null,
				category: body.category || "task",
				priority: body.priority || "medium",
				estimate: body.estimate || null,
				acceptanceCriteriaJson: JSON.stringify(body.acceptanceCriteria || []),
				tagsJson: JSON.stringify(body.tags || []),
				filesTouchedJson: JSON.stringify([]),
				status: body.status || "backlog",
				passes: false,
			},
		});

		return NextResponse.json({ task: formatTask(task) }, { status: 201 });
	} catch (error) {
		console.error("Error creating task:", error);
		return handleProjectRouteError(error);
	}
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string; sprintId: string }> },
) {
	try {
		const { id, sprintId } = await params;
		const { project } = await getProjectContextFromParams(id, request);

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
