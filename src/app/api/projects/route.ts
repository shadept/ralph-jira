import { NextResponse } from "next/server";
import { projectRegistry } from "@/lib/projects/registry";

export async function GET() {
	try {
		const projects = await projectRegistry.listProjects();
		return NextResponse.json({ projects });
	} catch (error) {
		console.error("Failed to list projects:", error);
		return NextResponse.json(
			{ error: "Failed to list projects" },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	try {
		const { name, path } = await request.json();

		if (!name || !path) {
			return NextResponse.json(
				{ error: "Name and path are required" },
				{ status: 400 },
			);
		}

		const project = await projectRegistry.addProject({ name, path });
		return NextResponse.json({ project });
	} catch (error) {
		console.error("Failed to create project:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to create project",
			},
			{ status: 400 },
		);
	}
}
