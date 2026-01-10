import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> }
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectContext(request);

		const run = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
			select: { cancellationRequestedAt: true },
		});

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		return NextResponse.json({
			canceled: run.cancellationRequestedAt !== null,
		});
	} catch (error) {
		console.error("Failed to check cancellation status", error);
		return handleProjectRouteError(error);
	}
}
