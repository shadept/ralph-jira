import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface AuthenticatedUser {
	id: string;
	email: string;
	name: string | null;
}

export interface OrgMembership {
	organizationId: string;
	role: "owner" | "admin" | "member";
}

/**
 * Get authenticated user from session
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
	const session = await auth();
	if (!session?.user?.id) {
		return null;
	}

	const user = await prisma.user.findUnique({
		where: { id: session.user.id, deletedAt: null },
		select: { id: true, email: true, name: true },
	});

	return user;
}

/**
 * Check if user has access to an organization
 */
export async function checkOrgAccess(
	userId: string,
	orgId: string,
	requiredRole?: "owner" | "admin" | "member"
): Promise<OrgMembership | null> {
	const membership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId,
			},
		},
	});

	if (!membership) {
		return null;
	}

	// Role hierarchy: owner > admin > member
	const roleHierarchy = { owner: 3, admin: 2, member: 1 };
	const userRoleLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] || 0;
	const requiredRoleLevel = requiredRole
		? roleHierarchy[requiredRole] || 0
		: 0;

	if (userRoleLevel < requiredRoleLevel) {
		return null;
	}

	return {
		organizationId: membership.organizationId,
		role: membership.role as "owner" | "admin" | "member",
	};
}

/**
 * Check if user has access to a project
 */
export async function checkProjectAccess(
	userId: string,
	projectId: string,
	requiredRole?: "owner" | "admin" | "member"
): Promise<{ orgId: string; projectId: string; role: string } | null> {
	const project = await prisma.project.findUnique({
		where: { id: projectId, deletedAt: null },
		select: { id: true, organizationId: true },
	});

	if (!project) {
		return null;
	}

	const membership = await checkOrgAccess(userId, project.organizationId, requiredRole);
	if (!membership) {
		return null;
	}

	return {
		orgId: project.organizationId,
		projectId: project.id,
		role: membership.role,
	};
}

/**
 * Get all organizations the user is a member of
 */
export async function getUserOrganizations(userId: string) {
	const memberships = await prisma.organizationMember.findMany({
		where: { userId },
		include: {
			organization: {
				select: {
					id: true,
					name: true,
					slug: true,
					logoUrl: true,
				},
			},
		},
	});

	return memberships.map((m) => ({
		...m.organization,
		role: m.role as "owner" | "admin" | "member",
	}));
}
