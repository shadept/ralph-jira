import path from "node:path";

import { NextResponse } from "next/server";

import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";
import { readRun, writeRun, tailLog, runLogPath } from "@/lib/runs/store";
import { RunRecordSchema } from "@/lib/schemas";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectStorage(request);
		const run = await readRun(project.path, runId);

		const url = new URL(request.url);
		const tailParam = Number(url.searchParams.get("tail") || "100");
		const tail = Number.isNaN(tailParam)
			? 100
			: Math.max(10, Math.min(tailParam, 500));

		// Try sandbox log first, then persisted log
		const sandboxLogFile = run.sandboxPath
			? path.join(project.path, run.sandboxPath, "progress.txt")
			: null;
		const persistedLogFile = runLogPath(project.path, runId);

		let logLines: string[] = [];
		if (sandboxLogFile) {
			logLines = await tailLog(sandboxLogFile, tail);
		}
		if (!logLines.length) {
			logLines = await tailLog(persistedLogFile, tail);
		}

		return NextResponse.json({ run, log: logLines });
	} catch (error) {
		console.error("Failed to fetch run details", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectStorage(request);
		const body = await request.json();

		// Validate the run record
		const run = RunRecordSchema.parse({ ...body, runId });

		await writeRun(project.path, run);

		return NextResponse.json({ run });
	} catch (error) {
		console.error("Failed to update run", error);
		return handleProjectRouteError(error);
	}
}
