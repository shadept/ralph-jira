import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get user's organizations
		const memberships = await prisma.organizationMember.findMany({
			where: { userId: session.user.id },
			select: { organizationId: true },
		});

		const orgIds = memberships.map((m) => m.organizationId);

		// Get projects from user's organizations
		const projects = await prisma.project.findMany({
			where: {
				organizationId: { in: orgIds },
				deletedAt: null,
			},
			include: {
				organization: {
					select: { name: true, slug: true },
				},
				settings: true,
			},
			orderBy: { updatedAt: "desc" },
		});

		// Transform to expected format
		const formattedProjects = projects.map((p) => ({
			id: p.id,
			name: p.name,
			slug: p.slug,
			description: p.description,
			path: p.repoUrl || "", // Legacy compatibility
			organizationId: p.organizationId,
			organizationName: p.organization.name,
			createdAt: p.createdAt.toISOString(),
			updatedAt: p.updatedAt.toISOString(),
		}));

		return NextResponse.json({ projects: formattedProjects });
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
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { name, organizationId, description, repoUrl } = await request.json();

		if (!name) {
			return NextResponse.json({ error: "Name is required" }, { status: 400 });
		}

		// Verify user has access to the organization
		let targetOrgId = organizationId;
		if (!targetOrgId) {
			// Get user's first organization
			const membership = await prisma.organizationMember.findFirst({
				where: { userId: session.user.id },
			});
			if (!membership) {
				return NextResponse.json(
					{ error: "No organization found" },
					{ status: 400 },
				);
			}
			targetOrgId = membership.organizationId;
		} else {
			// Verify membership
			const membership = await prisma.organizationMember.findUnique({
				where: {
					organizationId_userId: {
						organizationId: targetOrgId,
						userId: session.user.id,
					},
				},
			});
			if (!membership) {
				return NextResponse.json(
					{ error: "Access denied to organization" },
					{ status: 403 },
				);
			}
		}

		// Generate slug from name
		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");

		// Check if slug is unique within org
		const existingProject = await prisma.project.findFirst({
			where: {
				organizationId: targetOrgId,
				slug,
				deletedAt: null,
			},
		});

		const finalSlug = existingProject ? `${slug}-${Date.now()}` : slug;

		// Create project
		const project = await prisma.project.create({
			data: {
				organizationId: targetOrgId,
				name,
				slug: finalSlug,
				description: description || null,
				repoUrl: repoUrl || null,
			},
		});

		// Create default project settings
		await prisma.projectSettings.create({
			data: {
				projectId: project.id,
				projectName: name,
				projectDescription: description || "Add your project description",
				techStackJson: JSON.stringify([]),
				howToTestJson: JSON.stringify({ commands: [], notes: "" }),
				howToRunJson: JSON.stringify({ commands: [], notes: "" }),
				aiPreferencesJson: JSON.stringify({ defaultModel: "gpt-4" }),
				repoConventionsJson: JSON.stringify({ folders: {}, naming: "" }),
			},
		});

		return NextResponse.json({
			project: {
				id: project.id,
				name: project.name,
				slug: project.slug,
				description: project.description,
				path: project.repoUrl || "",
				organizationId: project.organizationId,
				createdAt: project.createdAt.toISOString(),
				updatedAt: project.updatedAt.toISOString(),
			},
		});
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
