import { NextResponse } from "next/server";

import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";
import { listRuns } from "@/lib/runs/store";

export async function GET(request: Request) {
	try {
		const { project } = await getProjectStorage(request);
		const runs = await listRuns(project.path);
		return NextResponse.json({ runs });
	} catch (error) {
		console.error("Failed to list runs", error);
		return handleProjectRouteError(error);
	}
}
