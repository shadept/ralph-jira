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
	{ params }: { params: Promise<{ id: string; sprintId: string }> }
) {
	try {
		const { id, sprintId } = await params;
		const { project } = await getProjectContextFromParams(id);

		const sprint = await prisma.sprint.findFirst({
			where: {
				id: sprintId,
				projectId: project.id,
			},
			include: {
				columns: { orderBy: { order: "asc" } },
				tasks: { orderBy: { createdAt: "asc" } },
			},
		});

		if (!sprint) {
			return NextResponse.json({ error: "Board not found" }, { status: 404 });
		}

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

		return NextResponse.json({ board });
	} catch (error) {
		console.error("Error fetching sprint:", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string; sprintId: string }> }
) {
	try {
		const { id, sprintId } = await params;
		const { project } = await getProjectContextFromParams(id);
		const updates = await request.json();

		const existing = await prisma.sprint.findFirst({
			where: { id: sprintId, projectId: project.id },
		});

		if (!existing) {
			return NextResponse.json({ error: "Board not found" }, { status: 404 });
		}

		await prisma.sprint.update({
			where: { id: sprintId },
			data: {
				name: updates.name ?? existing.name,
				goal: updates.goal !== undefined ? updates.goal : existing.goal,
				deadline: updates.deadline
					? new Date(updates.deadline)
					: existing.deadline,
				status: updates.status
					? mapBoardStatusToSprintStatus(updates.status)
					: existing.status,
				metricsJson: updates.metrics
					? JSON.stringify(updates.metrics)
					: existing.metricsJson,
			},
		});

		if (updates.columns) {
			await prisma.sprintColumn.deleteMany({ where: { sprintId } });
			await prisma.sprintColumn.createMany({
				data: updates.columns.map(
					(col: { id: string; name: string; order: number }) => ({
						sprintId,
						columnId: col.id,
						name: col.name,
						order: col.order,
					})
				),
			});
		}

		if (updates.tasks) {
			for (const task of updates.tasks) {
				if (task.id) {
					const existingTask = await prisma.task.findUnique({
						where: { id: task.id },
					});

					if (existingTask) {
						await prisma.task.update({
							where: { id: task.id },
							data: {
								category: task.category ?? existingTask.category,
								title:
									task.title !== undefined ? task.title : existingTask.title,
								description: task.description ?? existingTask.description,
								acceptanceCriteriaJson: task.acceptanceCriteria
									? JSON.stringify(task.acceptanceCriteria)
									: existingTask.acceptanceCriteriaJson,
								status: task.status ?? existingTask.status,
								priority: task.priority ?? existingTask.priority,
								passes: task.passes ?? existingTask.passes,
								estimate:
									task.estimate !== undefined
										? task.estimate
										: existingTask.estimate,
								deadline: task.deadline
									? new Date(task.deadline)
									: existingTask.deadline,
								tagsJson: task.tags
									? JSON.stringify(task.tags)
									: existingTask.tagsJson,
								filesTouchedJson: task.filesTouched
									? JSON.stringify(task.filesTouched)
									: existingTask.filesTouchedJson,
								failureNotes:
									task.failureNotes !== undefined
										? task.failureNotes
										: existingTask.failureNotes,
								lastRun: task.lastRun
									? new Date(task.lastRun)
									: existingTask.lastRun,
							},
						});
					} else {
						await prisma.task.create({
							data: {
								id: task.id,
								projectId: project.id,
								sprintId,
								category: task.category || "task",
								title: task.title || null,
								description: task.description || "",
								acceptanceCriteriaJson: JSON.stringify(
									task.acceptanceCriteria || []
								),
								status: task.status || "backlog",
								priority: task.priority || "medium",
								passes: task.passes || false,
								estimate: task.estimate || null,
								deadline: task.deadline ? new Date(task.deadline) : null,
								tagsJson: JSON.stringify(task.tags || []),
								filesTouchedJson: JSON.stringify(task.filesTouched || []),
							},
						});
					}
				} else {
					await prisma.task.create({
						data: {
							projectId: project.id,
							sprintId,
							category: task.category || "task",
							title: task.title || null,
							description: task.description || "",
							acceptanceCriteriaJson: JSON.stringify(
								task.acceptanceCriteria || []
							),
							status: task.status || "backlog",
							priority: task.priority || "medium",
							passes: task.passes || false,
							estimate: task.estimate || null,
							deadline: task.deadline ? new Date(task.deadline) : null,
							tagsJson: JSON.stringify(task.tags || []),
							filesTouchedJson: JSON.stringify(task.filesTouched || []),
						},
					});
				}
			}
		}

		const updatedSprint = await prisma.sprint.findUnique({
			where: { id: sprintId },
			include: {
				columns: { orderBy: { order: "asc" } },
				tasks: { orderBy: { createdAt: "asc" } },
			},
		});

		// Format as board for backward compatibility
		const board = {
			id: updatedSprint!.id,
			name: updatedSprint!.name,
			goal: updatedSprint!.goal || "",
			deadline: updatedSprint!.deadline.toISOString(),
			status: mapSprintStatusToBoardStatus(updatedSprint!.status),
			columns: updatedSprint!.columns.map((col) => ({
				id: col.columnId,
				name: col.name,
				order: col.order,
			})),
			tasks: updatedSprint!.tasks.map((task) => ({
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
			createdAt: updatedSprint!.createdAt.toISOString(),
			updatedAt: updatedSprint!.updatedAt.toISOString(),
			metrics: updatedSprint!.metricsJson
				? JSON.parse(updatedSprint!.metricsJson)
				: undefined,
		};

		return NextResponse.json({ success: true, board });
	} catch (error) {
		console.error("Error updating sprint:", error);
		return handleProjectRouteError(error);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string; sprintId: string }> }
) {
	try {
		const { id, sprintId } = await params;
		const { project } = await getProjectContextFromParams(id);

		const sprint = await prisma.sprint.findFirst({
			where: { id: sprintId, projectId: project.id },
		});

		if (!sprint) {
			return NextResponse.json({ error: "Board not found" }, { status: 404 });
		}

		await prisma.sprint.update({
			where: { id: sprintId },
			data: { archivedAt: new Date() },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting sprint:", error);
		return handleProjectRouteError(error);
	}
}
