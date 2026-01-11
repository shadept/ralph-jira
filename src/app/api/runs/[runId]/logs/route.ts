import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectContext(request);

		const url = new URL(request.url);
		const limitParam = Number(url.searchParams.get("limit") || "100");
		const limit = Number.isNaN(limitParam)
			? 100
			: Math.max(10, Math.min(limitParam, 1000));

		// Verify run exists and belongs to project
		const run = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
		});

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		// Get logs from database
		const logs = await prisma.runLog.findMany({
			where: { runId: run.id },
			orderBy: { createdAt: "desc" },
			take: limit,
		});

		return NextResponse.json({
			logs: logs.map((l) => ({
				id: l.id,
				runId: l.runId,
				level: l.level,
				message: l.message,
				createdAt: l.createdAt.toISOString(),
			})),
		});
	} catch (error) {
		console.error("Failed to fetch run logs", error);
		return handleProjectRouteError(error);
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectContext(request);
		const body = await request.json();

		if (typeof body.message !== "string") {
			return NextResponse.json(
				{ error: "Missing or invalid message field" },
				{ status: 400 },
			);
		}

		// Verify run exists and belongs to project
		const run = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
		});

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		// Append log entry
		await prisma.runLog.create({
			data: {
				runId: run.id,
				level: body.level || "info",
				message: body.message,
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to append run log", error);
		return handleProjectRouteError(error);
	}
}
