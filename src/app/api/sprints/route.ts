import { NextResponse } from "next/server";
import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";

export async function GET(request: Request) {
	try {
		const { storage } = await getProjectStorage(request);
		// For now, use boards as sprints (backwards compatible)
		const boardIds = await storage.listBoards();
		const sprints = await Promise.all(
			boardIds.map((id) => storage.readBoard(id)),
		);

		return NextResponse.json({ sprints });
	} catch (error) {
		console.error("Error fetching sprints:", error);
		return handleProjectRouteError(error);
	}
}

export async function POST(request: Request) {
	try {
		const { storage } = await getProjectStorage(request);
		const sprint = await request.json();

		const now = new Date().toISOString();
		sprint.createdAt = sprint.createdAt || now;
		sprint.updatedAt = now;

		// For now, use boards as sprints (backwards compatible)
		await storage.writeBoard(sprint);

		return NextResponse.json({ success: true, sprint });
	} catch (error) {
		console.error("Error creating sprint:", error);
		return handleProjectRouteError(error);
	}
}
