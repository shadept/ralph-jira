import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

function formatSprint(sprint: {
	id: string;
	name: string;
	goal: string | null;
	deadline: Date;
	status: string;
	metricsJson: string | null;
	createdAt: Date;
	updatedAt: Date;
	columns: { columnId: string; name: string; order: number }[];
	tasks: {
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
	}[];
}) {
	return {
		id: sprint.id,
		name: sprint.name,
		goal: sprint.goal || "",
		deadline: sprint.deadline.toISOString(),
		status: sprint.status,
		columns: sprint.columns.map((col) => ({
			id: col.columnId,
			name: col.name,
			order: col.order,
		})),
		tasks: sprint.tasks.map((task) => ({
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
		})),
		createdAt: sprint.createdAt.toISOString(),
		updatedAt: sprint.updatedAt.toISOString(),
		metrics: sprint.metricsJson ? JSON.parse(sprint.metricsJson) : undefined,
	};
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id);

		const dbSprints = await prisma.sprint.findMany({
			where: {
				projectId: project.id,
				archivedAt: null,
			},
			include: {
				columns: { orderBy: { order: "asc" } },
				tasks: { orderBy: { createdAt: "asc" } },
			},
			orderBy: { createdAt: "desc" },
		});

		const sprints = dbSprints.map(formatSprint);

		return NextResponse.json({ sprints });
	} catch (error) {
		console.error("Error fetching sprints:", error);
		return handleProjectRouteError(error);
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id);
		const body = await request.json();

		const now = new Date();

		const dbSprint = await prisma.sprint.create({
			data: {
				projectId: project.id,
				name: body.name || "New Sprint",
				goal: body.goal || "",
				deadline: body.deadline ? new Date(body.deadline) : now,
				status: body.status || "planning",
				metricsJson: body.metrics ? JSON.stringify(body.metrics) : null,
				columns: {
					create: body.columns?.map(
						(col: { id: string; name: string; order: number }) => ({
							columnId: col.id,
							name: col.name,
							order: col.order,
						}),
					) || [
						{ columnId: "backlog", name: "Backlog", order: 0 },
						{ columnId: "todo", name: "To Do", order: 1 },
						{ columnId: "in_progress", name: "In Progress", order: 2 },
						{ columnId: "review", name: "Review", order: 3 },
						{ columnId: "done", name: "Done", order: 4 },
					],
				},
			},
			include: {
				columns: { orderBy: { order: "asc" } },
				tasks: true,
			},
		});

		const sprint = formatSprint(dbSprint);

		return NextResponse.json({ success: true, sprint });
	} catch (error) {
		console.error("Error creating sprint:", error);
		return handleProjectRouteError(error);
	}
}
