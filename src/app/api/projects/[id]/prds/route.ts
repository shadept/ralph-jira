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

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id, request);

		// Parse query params for filtering
		const url = new URL(request.url);
		const includeArchived = url.searchParams.get("includeArchived") === "true";
		const status = url.searchParams.get("status");

		// Build where clause
		const where: {
			projectId: string;
			deletedAt: null;
			archivedAt?: null | { not: null };
			status?: string;
		} = {
			projectId: project.id,
			deletedAt: null,
		};

		// By default, exclude archived PRDs
		if (!includeArchived) {
			where.archivedAt = null;
		}

		// Filter by status if provided
		if (status) {
			where.status = status;
		}

		const prds = await prisma.prd.findMany({
			where,
			orderBy: [{ order: "asc" }, { createdAt: "desc" }],
		});

		return NextResponse.json({
			prds: prds.map(formatPrd),
			totalCount: prds.length,
		});
	} catch (error) {
		console.error("Error fetching PRDs:", error);
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

		// Title is required
		if (
			!body.title ||
			typeof body.title !== "string" ||
			body.title.trim() === ""
		) {
			return NextResponse.json(
				{ error: "Title is required", code: "VALIDATION_ERROR" },
				{ status: 400 },
			);
		}

		// Get the max order to place new PRD at the end
		const maxOrderResult = await prisma.prd.aggregate({
			where: {
				projectId: project.id,
				deletedAt: null,
			},
			_max: {
				order: true,
			},
		});
		const nextOrder = (maxOrderResult._max.order ?? -1) + 1;

		const prd = await prisma.prd.create({
			data: {
				projectId: project.id,
				title: body.title.trim(),
				content: body.content || "",
				status: body.status || "draft",
				priority: body.priority || "medium",
				tagsJson: JSON.stringify(body.tags || []),
				order: body.order !== undefined ? body.order : nextOrder,
			},
		});

		return NextResponse.json({ prd: formatPrd(prd) }, { status: 201 });
	} catch (error) {
		console.error("Error creating PRD:", error);
		return handleProjectRouteError(error);
	}
}
