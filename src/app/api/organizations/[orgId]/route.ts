import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateOrgSchema = z.object({
	name: z.string().min(1, "Organization name is required").optional(),
	slug: z
		.string()
		.min(2, "Slug must be at least 2 characters")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug can only contain lowercase letters, numbers, and hyphens",
		)
		.optional(),
	logoUrl: z.string().url().nullable().optional(),
});

/**
 * GET /api/organizations/[orgId]
 * Get organization details and members
 * Any member can read
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ orgId: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const { orgId } = await params;

		// Check user is a member of this org
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: orgId,
					userId: session.user.id,
				},
			},
		});

		if (!membership) {
			return NextResponse.json(
				{ success: false, error: "You don't have access to this organization" },
				{ status: 403 },
			);
		}

		const organization = await prisma.organization.findUnique({
			where: { id: orgId, deletedAt: null },
		});

		if (!organization) {
			return NextResponse.json(
				{ success: false, error: "Organization not found" },
				{ status: 404 },
			);
		}

		const members = await prisma.organizationMember.findMany({
			where: { organizationId: orgId },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true,
					},
				},
			},
			orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
		});

		const projects = await prisma.project.findMany({
			where: { organizationId: orgId, deletedAt: null },
			select: {
				id: true,
				name: true,
				description: true,
				repoUrl: true,
				createdAt: true,
				updatedAt: true,
			},
			orderBy: { updatedAt: "desc" },
		});

		// Get subscription with plan limits
		const subscription = await prisma.subscription.findUnique({
			where: { organizationId: orgId },
			include: { plan: true },
		});

		return NextResponse.json({
			success: true,
			organization: {
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				logoUrl: organization.logoUrl,
				createdAt: organization.createdAt.toISOString(),
				updatedAt: organization.updatedAt.toISOString(),
				projectCount: projects.length,
			},
			members: members.map((m) => ({
				id: m.id,
				userId: m.userId,
				role: m.role,
				joinedAt: m.joinedAt.toISOString(),
				user: {
					id: m.user.id,
					name: m.user.name,
					email: m.user.email,
					image: m.user.avatarUrl,
				},
			})),
			projects: projects.map((p) => ({
				id: p.id,
				name: p.name,
				description: p.description,
				path: p.repoUrl || "",
				createdAt: p.createdAt.toISOString(),
				updatedAt: p.updatedAt.toISOString(),
			})),
			limits: {
				maxUsers: subscription?.plan.maxUsers ?? null,
				maxProjects: subscription?.plan.maxProjects ?? null,
			},
			currentUserRole: membership.role,
		});
	} catch (error) {
		console.error("Error fetching organization:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch organization" },
			{ status: 500 },
		);
	}
}

/**
 * PUT /api/organizations/[orgId]
 * Update organization settings
 * Only owners can update
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ orgId: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const { orgId } = await params;

		// Check user is an owner of this org
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: orgId,
					userId: session.user.id,
				},
			},
		});

		if (!membership || membership.role !== "owner") {
			return NextResponse.json(
				{
					success: false,
					error: "Only organization owners can update settings",
				},
				{ status: 403 },
			);
		}

		const body = await request.json();
		const parsed = updateOrgSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					success: false,
					errors: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const { name, slug, logoUrl } = parsed.data;

		// Check slug uniqueness if changing
		if (slug) {
			const existingOrg = await prisma.organization.findFirst({
				where: {
					slug,
					id: { not: orgId },
					deletedAt: null,
				},
			});

			if (existingOrg) {
				return NextResponse.json(
					{
						success: false,
						error: "This URL slug is already taken",
					},
					{ status: 400 },
				);
			}
		}

		const organization = await prisma.organization.update({
			where: { id: orgId },
			data: {
				...(name && { name }),
				...(slug && { slug }),
				...(logoUrl !== undefined && { logoUrl }),
			},
		});

		return NextResponse.json({
			success: true,
			organization: {
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				logoUrl: organization.logoUrl,
				createdAt: organization.createdAt.toISOString(),
				updatedAt: organization.updatedAt.toISOString(),
			},
		});
	} catch (error) {
		console.error("Error updating organization:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to update organization" },
			{ status: 500 },
		);
	}
}
