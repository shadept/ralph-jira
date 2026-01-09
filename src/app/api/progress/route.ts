import { NextResponse } from "next/server";
import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";

export async function GET(request: Request) {
	try {
		const { storage } = await getProjectStorage(request);
		const progress = await storage.readProgress();
		return NextResponse.json({ progress });
	} catch (error) {
		console.error("Error fetching progress:", error);
		return handleProjectRouteError(error);
	}
}

export async function POST(request: Request) {
	try {
		const { storage } = await getProjectStorage(request);
		const { entry } = await request.json();
		await storage.appendProgress(entry);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error appending to progress:", error);
		return handleProjectRouteError(error);
	}
}
