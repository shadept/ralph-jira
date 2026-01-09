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
		const { storage } = await getProjectStorage(request);
		const settings = await storage.readSettings();
		return NextResponse.json(settings);
	} catch (error) {
		console.error("Error fetching project settings:", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { storage } = await getProjectStorage(request);
		const updates = await request.json();

		// Get existing settings and merge
		const settings = await storage.readSettings();
		const updatedSettings = {
			...settings,
			...updates,
		};

		await storage.writeSettings(updatedSettings);

		return NextResponse.json({ success: true, settings: updatedSettings });
	} catch (error) {
		console.error("Error updating project settings:", error);
		return handleProjectRouteError(error);
	}
}
