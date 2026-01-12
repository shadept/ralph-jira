import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

function formatPrd(prd: {
	id: string;
	projectId: string;
	title: string;
	content: string;
	status: string;
	priority: string;
	tagsJson: string;
	order: number;
	createdAt: Date;
	updatedAt: Date;
	archivedAt: Date | null;
}) {
	return {
		id: prd.id,
		projectId: prd.projectId,
		title: prd.title,
		content: prd.content,
		status: prd.status,
		priority: prd.priority,
		tags: JSON.parse(prd.tagsJson),
		order: prd.order,
		createdAt: prd.createdAt.toISOString(),
		updatedAt: prd.updatedAt.toISOString(),
		archivedAt: prd.archivedAt?.toISOString() || null,
	};
}

// Minimal sprint info for linked sprints
interface LinkedSprint {
	id: string;
	name: string;
	status: string;
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string; prdId: string }> },
) {
	try {
		const { id, prdId } = await params;
		const { project } = await getProjectContextFromParams(id, request);

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

		// Fetch sprints linked to this PRD (via sourcePrdId)
		const linkedSprintsData = await prisma.sprint.findMany({
			where: {
				sourcePrdId: prdId,
				projectId: project.id,
			},
			select: {
				id: true,
				name: true,
				status: true,
			},
			orderBy: { createdAt: "desc" },
		});

		const linkedSprints: LinkedSprint[] = linkedSprintsData.map((sprint: { id: string; name: string; status: string }) => ({
			id: sprint.id,
			name: sprint.name,
			status: sprint.status,
		}));

		return NextResponse.json({ prd: formatPrd(prd), linkedSprints });
	} catch (error) {
		console.error("Error fetching PRD:", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string; prdId: string }> },
) {
	try {
		const { id, prdId } = await params;
		const { project } = await getProjectContextFromParams(id, request);
		const body = await request.json();

		// Verify PRD exists and belongs to project
		const existingPrd = await prisma.prd.findFirst({
			where: {
				id: prdId,
				projectId: project.id,
				deletedAt: null,
			},
		});

		if (!existingPrd) {
			return NextResponse.json(
				{ error: "PRD not found", code: "PRD_NOT_FOUND" },
				{ status: 404 },
			);
		}

		// Validate title if provided - it cannot be empty
		if (body.title !== undefined) {
			if (typeof body.title !== "string" || body.title.trim() === "") {
				return NextResponse.json(
					{ error: "Title cannot be empty", code: "VALIDATION_ERROR" },
					{ status: 400 },
				);
			}
		}

		// Determine status update - archived flag takes precedence over explicit status
		let statusUpdate: string | undefined = undefined;
		if (body.archived !== undefined) {
			statusUpdate = body.archived ? "archived" : "draft";
		} else if (body.status !== undefined) {
			statusUpdate = body.status;
		}

		const prd = await prisma.prd.update({
			where: { id: prdId },
			data: {
				title: body.title !== undefined ? body.title.trim() : undefined,
				content: body.content !== undefined ? body.content : undefined,
				status: statusUpdate,
				priority: body.priority !== undefined ? body.priority : undefined,
				tagsJson:
					body.tags !== undefined ? JSON.stringify(body.tags) : undefined,
				order: body.order !== undefined ? body.order : undefined,
				archivedAt:
					body.archived !== undefined
						? body.archived
							? new Date()
							: null
						: undefined,
			},
		});

		return NextResponse.json({ prd: formatPrd(prd) });
	} catch (error) {
		console.error("Error updating PRD:", error);
		return handleProjectRouteError(error);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string; prdId: string }> },
) {
	try {
		const { id, prdId } = await params;
		const { project } = await getProjectContextFromParams(id, request);

		// Verify PRD exists and belongs to project
		const existingPrd = await prisma.prd.findFirst({
			where: {
				id: prdId,
				projectId: project.id,
				deletedAt: null,
			},
		});

		if (!existingPrd) {
			return NextResponse.json(
				{ error: "PRD not found", code: "PRD_NOT_FOUND" },
				{ status: 404 },
			);
		}

		// Soft delete the PRD
		await prisma.prd.update({
			where: { id: prdId },
			data: { deletedAt: new Date() },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting PRD:", error);
		return handleProjectRouteError(error);
	}
}
