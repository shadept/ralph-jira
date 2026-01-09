import { NextResponse } from "next/server";

import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";
import { readRun, appendRunLog, getRunLogs } from "@/lib/runs/store";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectStorage(request);

		const url = new URL(request.url);
		const limitParam = Number(url.searchParams.get("limit") || "100");
		const limit = Number.isNaN(limitParam)
			? 100
			: Math.max(10, Math.min(limitParam, 1000));

		// Verify run exists
		await readRun(project.path, runId);

		// Get logs from database or file
		const logs = await getRunLogs(project.path, runId, limit);

		return NextResponse.json({ logs });
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
		const { project } = await getProjectStorage(request);
		const body = await request.json();

		if (typeof body.entry !== "string") {
			return NextResponse.json(
				{ error: "Missing or invalid entry field" },
				{ status: 400 },
			);
		}

		// Verify run exists
		await readRun(project.path, runId);

		// Append log entry
		await appendRunLog(project.path, runId, body.entry);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to append run log", error);
		return handleProjectRouteError(error);
	}
}
