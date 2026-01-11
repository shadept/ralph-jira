import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function GET(request: Request) {
	try {
		const { project } = await getProjectContext(request);

		// Get recent logs from all runs for this project
		const logs = await prisma.runLog.findMany({
			where: {
				run: { projectId: project.id },
			},
			orderBy: { createdAt: "desc" },
			take: 100,
			include: {
				run: { select: { runId: true } },
			},
		});

		// Format as progress text
		const progress = logs
			.reverse()
			.map(
				(log) =>
					`[${log.createdAt.toISOString()}] [${log.run.runId}] [${log.level}] ${log.message}`,
			)
			.join("\n");

		return NextResponse.json({
			progress: progress || "# Project Progress Log\n",
		});
	} catch (error) {
		console.error("Error fetching progress:", error);
		return handleProjectRouteError(error);
	}
}

export async function POST(request: Request) {
	try {
		const { project } = await getProjectContext(request);
		const { message, level = "info", runId } = await request.json();

		if (!message) {
			return NextResponse.json(
				{ error: "Message is required" },
				{ status: 400 },
			);
		}

		// If runId is provided, attach to that run
		if (runId) {
			const run = await prisma.run.findFirst({
				where: { runId, projectId: project.id },
			});

			if (run) {
				await prisma.runLog.create({
					data: {
						runId: run.id,
						level,
						message,
					},
				});
			}
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error appending to progress:", error);
		return handleProjectRouteError(error);
	}
}
