import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

// Map sprint status to board status for backward compatibility
function mapSprintStatusToBoardStatus(
	status: string
): "planned" | "active" | "completed" | "archived" {
	switch (status) {
		case "planning":
			return "planned";
		case "active":
			return "active";
		case "completed":
			return "completed";
		case "archived":
			return "archived";
		default:
			return "planned";
	}
}

// Map board status to sprint status
function mapBoardStatusToSprintStatus(
	status: string
): "planning" | "active" | "completed" | "archived" {
	switch (status) {
		case "planned":
			return "planning";
		case "active":
			return "active";
		case "completed":
			return "completed";
		case "archived":
			return "archived";
		default:
			return "planning";
	}
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id);

		const sprints = await prisma.sprint.findMany({
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

		// Format as boards for backward compatibility
		const boards = sprints.map((sprint) => ({
			id: sprint.id,
			name: sprint.name,
			goal: sprint.goal || "",
			deadline: sprint.deadline.toISOString(),
			status: mapSprintStatusToBoardStatus(sprint.status),
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
		}));

		return NextResponse.json({ boards });
	} catch (error) {
		console.error("Error fetching sprints:", error);
		return handleProjectRouteError(error);
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id);
		const body = await request.json();

		const now = new Date();

		const sprint = await prisma.sprint.create({
			data: {
				projectId: project.id,
				name: body.name || "New Sprint",
				goal: body.goal || "",
				deadline: body.deadline ? new Date(body.deadline) : now,
				status: body.status ? mapBoardStatusToSprintStatus(body.status) : "planning",
				metricsJson: body.metrics ? JSON.stringify(body.metrics) : null,
				columns: {
					create:
						body.columns?.map(
							(col: { id: string; name: string; order: number }) => ({
								columnId: col.id,
								name: col.name,
								order: col.order,
							})
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

		// Format as board for backward compatibility
		const board = {
			id: sprint.id,
			name: sprint.name,
			goal: sprint.goal || "",
			deadline: sprint.deadline.toISOString(),
			status: mapSprintStatusToBoardStatus(sprint.status),
			columns: sprint.columns.map((col) => ({
				id: col.columnId,
				name: col.name,
				order: col.order,
			})),
			tasks: [],
			createdAt: sprint.createdAt.toISOString(),
			updatedAt: sprint.updatedAt.toISOString(),
			metrics: sprint.metricsJson ? JSON.parse(sprint.metricsJson) : undefined,
		};

		return NextResponse.json({ success: true, board });
	} catch (error) {
		console.error("Error creating sprint:", error);
		return handleProjectRouteError(error);
	}
}
