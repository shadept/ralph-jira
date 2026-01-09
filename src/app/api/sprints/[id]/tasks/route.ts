import { NextResponse } from "next/server";
import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { storage } = await getProjectStorage(request);
		// For now, use boards as sprints (backwards compatible)
		const sprint = await storage.readBoard(id);
		return NextResponse.json({ tasks: sprint.tasks || [] });
	} catch (error) {
		console.error("Error fetching sprint tasks:", error);
		return handleProjectRouteError(error);
	}
}
