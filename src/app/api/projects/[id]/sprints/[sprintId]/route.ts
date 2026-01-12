import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";
import { sanitizeQuotes, sanitizeStringArray } from "@/lib/utils";

/**
 * Ensures a value is an array, parsing JSON strings if needed.
 * Handles double-stringified JSON from agent file edits.
 */
function ensureArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((v) => (typeof v === "string" ? sanitizeQuotes(v) : v));
	}
	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) {
				return parsed.map((v) =>
					typeof v === "string" ? sanitizeQuotes(v) : v,
				);
			}
		} catch {
			// Not valid JSON, return empty array
		}
	}
	return [];
}

function formatSprint(sprint: {
	id: string;
	name: string;
	goal: string | null;
	deadline: Date;
	status: string;
	sourcePrdId: string | null;
	metricsJson: string | null;
	createdAt: Date;
	updatedAt: Date;
	columns: { columnId: string; name: string; order: number }[];
	tasks: {
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
	}[];
}) {
	return {
		id: sprint.id,
		name: sprint.name,
		goal: sprint.goal || "",
		deadline: sprint.deadline.toISOString(),
		status: sprint.status,
		sourcePrdId: sprint.sourcePrdId || null,
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
	request: Request,
	{ params }: { params: Promise<{ id: string; sprintId: string }> },
) {
	try {
		const { id, sprintId } = await params;
		const { project } = await getProjectContextFromParams(id, request);

		const dbSprint = await prisma.sprint.findFirst({
			where: {
				id: sprintId,
				projectId: project.id,
			},
			include: {
				columns: { orderBy: { order: "asc" } },
				tasks: true,
			},
		});

		// Sort tasks by priority (urgent > high > medium > low) then by createdAt
		if (dbSprint?.tasks) {
			const priorityOrder: Record<string, number> = {
				urgent: 0,
				high: 1,
				medium: 2,
				low: 3,
			};
			dbSprint.tasks.sort((a, b) => {
				const priorityDiff =
					(priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
				if (priorityDiff !== 0) return priorityDiff;
				return a.createdAt.getTime() - b.createdAt.getTime();
			});
		}

		if (!dbSprint) {
			return NextResponse.json(
				{ error: "Sprint not found", code: "SPRINT_NOT_FOUND" },
				{ status: 404 },
			);
		}

		const sprint = formatSprint(dbSprint);

		return NextResponse.json({ sprint });
	} catch (error) {
		console.error("Error fetching sprint:", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string; sprintId: string }> },
) {
	try {
		const { id, sprintId } = await params;
		const { project } = await getProjectContextFromParams(id, request);
		const updates = await request.json();

		const existing = await prisma.sprint.findFirst({
			where: { id: sprintId, projectId: project.id },
		});

		if (!existing) {
			return NextResponse.json(
				{ error: "Sprint not found", code: "SPRINT_NOT_FOUND" },
				{ status: 404 },
			);
		}

		await prisma.sprint.update({
			where: { id: sprintId },
			data: {
				name: updates.name ?? existing.name,
				goal: updates.goal !== undefined ? updates.goal : existing.goal,
				deadline: updates.deadline
					? new Date(updates.deadline)
					: existing.deadline,
				status: updates.status ?? existing.status,
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
					}),
				),
			});
		}

		if (updates.tasks) {
			for (const task of updates.tasks) {
				// Sanitize incoming data - handles smart quotes and stringified arrays
				const sanitizedTitle = task.title
					? sanitizeQuotes(task.title.trim())
					: null;
				const sanitizedDescription = task.description
					? sanitizeQuotes(task.description)
					: null;
				const sanitizedAcceptanceCriteria = ensureArray(
					task.acceptanceCriteria,
				);
				const sanitizedTags = ensureArray(task.tags);
				const sanitizedFilesTouched = ensureArray(task.filesTouched);
				const sanitizedFailureNotes = task.failureNotes
					? sanitizeQuotes(task.failureNotes)
					: task.failureNotes;

				if (task.id) {
					// Use upsert to atomically create or update - avoids race conditions
					// when multiple requests try to update the same task simultaneously
					if (!sanitizedTitle) {
						// For upsert, we need a valid title for create case
						// If task exists, update will preserve existing title
						// If task doesn't exist and no title, skip
						const exists = await prisma.task.findUnique({
							where: { id: task.id },
							select: { id: true },
						});
						if (!exists) continue;
					}

					await prisma.task.upsert({
						where: { id: task.id },
						create: {
							id: task.id,
							projectId: project.id,
							sprintId,
							category: task.category || "task",
							title: sanitizedTitle || "Untitled Task",
							description: sanitizedDescription,
							acceptanceCriteriaJson: JSON.stringify(
								sanitizedAcceptanceCriteria,
							),
							status: task.status || "backlog",
							priority: task.priority || "medium",
							passes: task.passes || false,
							estimate: task.estimate || null,
							deadline: task.deadline ? new Date(task.deadline) : null,
							tagsJson: JSON.stringify(sanitizedTags),
							filesTouchedJson: JSON.stringify(sanitizedFilesTouched),
						},
						update: {
							category: task.category,
							title: sanitizedTitle || undefined, // undefined means don't update
							description:
								task.description !== undefined ? sanitizedDescription : undefined,
							acceptanceCriteriaJson:
								task.acceptanceCriteria !== undefined
									? JSON.stringify(sanitizedAcceptanceCriteria)
									: undefined,
							status: task.status,
							priority: task.priority,
							passes: task.passes,
							estimate: task.estimate,
							deadline: task.deadline ? new Date(task.deadline) : undefined,
							tagsJson:
								task.tags !== undefined
									? JSON.stringify(sanitizedTags)
									: undefined,
							filesTouchedJson:
								task.filesTouched !== undefined
									? JSON.stringify(sanitizedFilesTouched)
									: undefined,
							failureNotes:
								task.failureNotes !== undefined
									? sanitizedFailureNotes
									: undefined,
							lastRun: task.lastRun ? new Date(task.lastRun) : undefined,
						},
					});
				} else {
					// New task without ID - title is required
					if (!sanitizedTitle) {
						continue; // Skip tasks without a valid title
					}
					await prisma.task.create({
						data: {
							projectId: project.id,
							sprintId,
							category: task.category || "task",
							title: sanitizedTitle,
							description: sanitizedDescription,
							acceptanceCriteriaJson: JSON.stringify(
								sanitizedAcceptanceCriteria,
							),
							status: task.status || "backlog",
							priority: task.priority || "medium",
							passes: task.passes || false,
							estimate: task.estimate || null,
							deadline: task.deadline ? new Date(task.deadline) : null,
							tagsJson: JSON.stringify(sanitizedTags),
							filesTouchedJson: JSON.stringify(sanitizedFilesTouched),
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

		if (!updatedSprint) {
			return NextResponse.json(
				{ error: "Sprint not found after update" },
				{ status: 404 },
			);
		}

		const sprint = formatSprint(updatedSprint);

		return NextResponse.json({ success: true, sprint });
	} catch (error) {
		console.error("Error updating sprint:", error);
		return handleProjectRouteError(error);
	}
}

export async function DELETE(
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
			return NextResponse.json(
				{ error: "Sprint not found", code: "SPRINT_NOT_FOUND" },
				{ status: 404 },
			);
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
