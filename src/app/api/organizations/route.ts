import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/organizations
 * Get all organizations the current user belongs to
 */
export async function GET() {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const memberships = await prisma.organizationMember.findMany({
			where: { userId: session.user.id },
			include: {
				organization: {
					select: {
						id: true,
						name: true,
						slug: true,
						logoUrl: true,
						createdAt: true,
						_count: {
							select: {
								members: true,
								projects: true,
							},
						},
					},
				},
			},
			orderBy: { joinedAt: "asc" },
		});

		const organizations = memberships.map((m) => ({
			id: m.organization.id,
			name: m.organization.name,
			slug: m.organization.slug,
			logoUrl: m.organization.logoUrl,
			role: m.role,
			joinedAt: m.joinedAt.toISOString(),
			createdAt: m.organization.createdAt.toISOString(),
			memberCount: m.organization._count.members,
			projectCount: m.organization._count.projects,
		}));

		return NextResponse.json({
			success: true,
			organizations,
		});
	} catch (error) {
		console.error("Error fetching organizations:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch organizations" },
			{ status: 500 },
		);
	}
}
