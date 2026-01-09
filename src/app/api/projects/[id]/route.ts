import { NextResponse } from "next/server";
import { projectRegistry, ProjectNotFoundError } from "@/lib/projects/registry";

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		await projectRegistry.removeProject(id);
		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof ProjectNotFoundError) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}

		console.error("Failed to delete project:", error);
		return NextResponse.json(
			{ error: "Failed to delete project" },
			{ status: 400 },
		);
	}
}
