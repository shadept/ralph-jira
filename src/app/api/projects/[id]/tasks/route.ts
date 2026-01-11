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

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id, request);

		// Fetch all tasks for the project
		const tasks = await prisma.task.findMany({
			where: {
				projectId: project.id,
			},
			orderBy: [{ createdAt: "asc" }],
		});

		// Fetch all sprints to get names
		const sprints = await prisma.sprint.findMany({
			where: {
				projectId: project.id,
				archivedAt: null,
			},
			select: {
				id: true,
				name: true,
			},
			orderBy: { createdAt: "desc" },
		});

		const sprintMap = new Map(sprints.map((s) => [s.id, s.name]));

		// Group tasks by sprint
		const tasksBySprint: Record<string, typeof formattedTasks> = {};
		const formattedTasks = tasks.map(formatTask);

		for (const task of formattedTasks) {
			const key = task.sprintId || "__no_sprint__";
			if (!tasksBySprint[key]) {
				tasksBySprint[key] = [];
			}
			tasksBySprint[key].push(task);
		}

		// Build response with sprint metadata
		const groups = Object.entries(tasksBySprint).map(([sprintId, tasks]) => ({
			sprintId: sprintId === "__no_sprint__" ? null : sprintId,
			sprintName:
				sprintId === "__no_sprint__"
					? "No Sprint"
					: sprintMap.get(sprintId) || "Unknown Sprint",
			tasks,
		}));

		// Sort groups: "No Sprint" last, others by sprint name
		groups.sort((a, b) => {
			if (a.sprintId === null) return 1;
			if (b.sprintId === null) return -1;
			return a.sprintName.localeCompare(b.sprintName);
		});

		return NextResponse.json({
			groups,
			totalCount: tasks.length,
			sprints: sprints.map((s) => ({ id: s.id, name: s.name })),
		});
	} catch (error) {
		console.error("Error fetching tasks:", error);
		return handleProjectRouteError(error);
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id, request);
		const body = await request.json();

		// Title is now required
		if (!body.title || typeof body.title !== "string" || body.title.trim() === "") {
			return NextResponse.json(
				{ error: "Title is required", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		const task = await prisma.task.create({
			data: {
				projectId: project.id,
				sprintId: body.sprintId || null,
				category: body.category || "functional",
				title: body.title.trim(),
				description: body.description || null,
				acceptanceCriteriaJson: JSON.stringify(body.acceptanceCriteria || []),
				status: body.status || "backlog",
				priority: body.priority || "medium",
				passes: body.passes || false,
				estimate: body.estimate || null,
				deadline: body.deadline ? new Date(body.deadline) : null,
				tagsJson: JSON.stringify(body.tags || []),
				filesTouchedJson: JSON.stringify(body.filesTouched || []),
				assigneeId: body.assigneeId || null,
				failureNotes: body.failureNotes || null,
			},
		});

		return NextResponse.json({ task: formatTask(task) });
	} catch (error) {
		console.error("Error creating task:", error);
		return handleProjectRouteError(error);
	}
}
