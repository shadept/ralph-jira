import { NextResponse } from "next/server";
import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";

export async function GET(request: Request) {
	try {
		const { storage } = await getProjectStorage(request);
		const settings = await storage.readSettings();
		return NextResponse.json({ settings });
	} catch (error) {
		console.error("Error fetching settings:", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(request: Request) {
	try {
		const { storage } = await getProjectStorage(request);
		const settings = await request.json();
		await storage.writeSettings(settings);

		return NextResponse.json({ success: true, settings });
	} catch (error) {
		console.error("Error updating settings:", error);
		return handleProjectRouteError(error);
	}
}
