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
	sourcePrdId: string | null;
	metricsJson: string | null;
	createdAt: Date;
	updatedAt: Date;
	columns: { columnId: string; name: string; order: number }[];
}) {
	return {
		id: sprint.id,
		name: sprint.name,
		goal: sprint.goal || "",
		deadline: sprint.deadline.toISOString(),
		status: sprint.status,
		sourcePrdId: sprint.sourcePrdId,
		columns: sprint.columns.map((col) => ({
			id: col.columnId,
			name: col.name,
			order: col.order,
		})),
		createdAt: sprint.createdAt.toISOString(),
		updatedAt: sprint.updatedAt.toISOString(),
	};
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string; prdId: string }> },
) {
	try {
		const { id, prdId } = await params;
		const { project } = await getProjectContextFromParams(id, request);
		const body = await request.json();

		// Verify PRD exists and belongs to this project
		const prd = await prisma.prd.findFirst({
			where: {
				id: prdId,
				projectId: project.id,
				deletedAt: null,
			},
		});

		if (!prd) {
			return NextResponse.json(
				{ error: "PRD not found", code: "PRD_NOT_FOUND" },
				{ status: 404 },
			);
		}

		// Validate required fields
		if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
			return NextResponse.json(
				{ error: "Sprint name is required", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		if (!body.deadline) {
			return NextResponse.json(
				{ error: "Sprint deadline is required", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		// Parse deadline
		const deadline = new Date(body.deadline);
		if (Number.isNaN(deadline.getTime())) {
			return NextResponse.json(
				{ error: "Invalid deadline date", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		// Create sprint with sourcePrdId linkage
		const dbSprint = await prisma.sprint.create({
			data: {
				projectId: project.id,
				sourcePrdId: prdId, // Persistent linkage to source PRD
				name: body.name.trim(),
				goal: body.goal?.trim() || prd.title, // Use PRD title as default goal
				deadline,
				status: "planning",
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
			},
		});

		const sprint = formatSprint(dbSprint);

		return NextResponse.json(
			{
				success: true,
				sprint,
				message: `Sprint "${sprint.name}" created from PRD "${prd.title}"`,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error converting PRD to sprint:", error);
		return handleProjectRouteError(error);
	}
}
