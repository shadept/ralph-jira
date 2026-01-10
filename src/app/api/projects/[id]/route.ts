import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { id } = await params;

		const project = await prisma.project.findUnique({
			where: { id, deletedAt: null },
			include: {
				organization: {
					select: { name: true, slug: true },
				},
				settings: true,
			},
		});

		if (!project) {
			return NextResponse.json(
				{ error: "Project not found" },
				{ status: 404 }
			);
		}

		// Verify user has access to this project's organization
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: project.organizationId,
					userId: session.user.id,
				},
			},
		});

		if (!membership) {
			return NextResponse.json(
				{ error: "Access denied" },
				{ status: 403 }
			);
		}

		return NextResponse.json({
			project: {
				id: project.id,
				name: project.name,
				slug: project.slug,
				description: project.description,
				path: project.repoUrl || "",
				organizationId: project.organizationId,
				organizationName: project.organization.name,
				createdAt: project.createdAt.toISOString(),
				updatedAt: project.updatedAt.toISOString(),
				settings: project.settings,
			},
		});
	} catch (error) {
		console.error("Failed to get project:", error);
		return NextResponse.json(
			{ error: "Failed to get project" },
			{ status: 500 }
		);
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { id } = await params;
		const { name, description, repoUrl } = await request.json();

		const project = await prisma.project.findUnique({
			where: { id, deletedAt: null },
		});

		if (!project) {
			return NextResponse.json(
				{ error: "Project not found" },
				{ status: 404 }
			);
		}

		// Verify user has access
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: project.organizationId,
					userId: session.user.id,
				},
			},
		});

		if (!membership) {
			return NextResponse.json(
				{ error: "Access denied" },
				{ status: 403 }
			);
		}

		const updatedProject = await prisma.project.update({
			where: { id },
			data: {
				name: name || undefined,
				description: description !== undefined ? description : undefined,
				repoUrl: repoUrl !== undefined ? repoUrl : undefined,
			},
		});

		return NextResponse.json({
			project: {
				id: updatedProject.id,
				name: updatedProject.name,
				slug: updatedProject.slug,
				description: updatedProject.description,
				path: updatedProject.repoUrl || "",
				organizationId: updatedProject.organizationId,
				createdAt: updatedProject.createdAt.toISOString(),
				updatedAt: updatedProject.updatedAt.toISOString(),
			},
		});
	} catch (error) {
		console.error("Failed to update project:", error);
		return NextResponse.json(
			{ error: "Failed to update project" },
			{ status: 500 }
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { id } = await params;

		const project = await prisma.project.findUnique({
			where: { id, deletedAt: null },
		});

		if (!project) {
			return NextResponse.json(
				{ error: "Project not found" },
				{ status: 404 }
			);
		}

		// Verify user has admin access
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: project.organizationId,
					userId: session.user.id,
				},
			},
		});

		if (!membership || membership.role === "member") {
			return NextResponse.json(
				{ error: "Admin access required to delete projects" },
				{ status: 403 }
			);
		}

		// Soft delete the project
		await prisma.project.update({
			where: { id },
			data: { deletedAt: new Date() },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete project:", error);
		return NextResponse.json(
			{ error: "Failed to delete project" },
			{ status: 500 }
		);
	}
}
