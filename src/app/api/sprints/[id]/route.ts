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
		return NextResponse.json(sprint);
	} catch (error) {
		console.error("Error fetching sprint:", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { storage } = await getProjectStorage(request);
		const updates = await request.json();

		// For now, use boards as sprints (backwards compatible)
		const sprint = await storage.readBoard(id);

		const updatedSprint = {
			...sprint,
			...updates,
			id: sprint.id,
			updatedAt: new Date().toISOString(),
		};

		await storage.writeBoard(updatedSprint);

		return NextResponse.json({ success: true, sprint: updatedSprint });
	} catch (error) {
		console.error("Error updating sprint:", error);
		return handleProjectRouteError(error);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { storage } = await getProjectStorage(request);

		if (id === "prd" || id === "active") {
			return NextResponse.json(
				{ error: "Cannot delete the active sprint" },
				{ status: 400 },
			);
		}

		// For now, use boards as sprints (backwards compatible)
		await storage.deleteBoard(id);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting sprint:", error);
		return handleProjectRouteError(error);
	}
}
