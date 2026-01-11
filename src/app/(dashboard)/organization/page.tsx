import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
	NoOrganization,
	OrganizationClient,
	type OrgData,
} from "./organization-client";

async function getOrganizationData(userId: string): Promise<OrgData | null> {
	// Get user's first organization membership
	const membership = await prisma.organizationMember.findFirst({
		where: { userId },
		orderBy: { joinedAt: "asc" },
		select: {
			role: true,
			organizationId: true,
		},
	});

	if (!membership) {
		return null;
	}

	const orgId = membership.organizationId;

	const organization = await prisma.organization.findUnique({
		where: { id: orgId, deletedAt: null },
	});

	if (!organization) {
		return null;
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

	return {
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
			role: m.role as "owner" | "admin" | "member",
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
		currentUserRole: membership.role as "owner" | "admin" | "member",
	};
}

export default async function OrganizationPage() {
	const session = await auth();
	const orgData = await getOrganizationData(session?.user?.id);

	if (!orgData) {
		return <NoOrganization />;
	}

	return <OrganizationClient initialData={orgData} />;
}
