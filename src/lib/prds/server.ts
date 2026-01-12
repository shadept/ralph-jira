import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prd } from "@/lib/schemas";

// Minimal sprint info for linked sprints
export interface LinkedSprint {
	id: string;
	name: string;
	status: string;
}

export type PrdLoadResult =
	| { status: "success"; prd: Prd; projectId: string; linkedSprints: LinkedSprint[] }
	| { status: "not_found" }
	| { status: "unauthorized" }
	| { status: "no_access" };

/**
 * Server-side function to load a PRD by ID with auth verification.
 * Fetches the PRD, verifies the user has access to its project.
 */
export async function loadPrdById(prdId: string): Promise<PrdLoadResult> {
	const session = await auth();

	if (!session?.user?.id) {
		return { status: "unauthorized" };
	}

	const userId = session.user.id;

	// Fetch PRD with its project info
	const prd = await prisma.prd.findFirst({
		where: {
			id: prdId,
			deletedAt: null,
		},
		include: {
			project: {
				select: {
					id: true,
					organizationId: true,
				},
			},
		},
	});

	if (!prd) {
		return { status: "not_found" };
	}

	// Verify user has access to the project's organization
	const membership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: prd.project.organizationId,
				userId,
			},
		},
	});

	if (!membership) {
		return { status: "no_access" };
	}

	// Fetch sprints linked to this PRD (via sourcePrdId)
	const linkedSprintsData = await prisma.sprint.findMany({
		where: {
			sourcePrdId: prdId,
			projectId: prd.projectId,
		},
		select: {
			id: true,
			name: true,
			status: true,
		},
		orderBy: { createdAt: "desc" },
	});

	const linkedSprints: LinkedSprint[] = linkedSprintsData.map((sprint: { id: string; name: string; status: string }) => ({
		id: sprint.id,
		name: sprint.name,
		status: sprint.status,
	}));

	// Format the PRD for the client
	const formattedPrd: Prd = {
		id: prd.id,
		projectId: prd.projectId,
		title: prd.title,
		content: prd.content,
		status: prd.status as Prd["status"],
		priority: prd.priority as Prd["priority"],
		tags: JSON.parse(prd.tagsJson),
		order: prd.order,
		createdAt: prd.createdAt.toISOString(),
		updatedAt: prd.updatedAt.toISOString(),
		archivedAt: prd.archivedAt?.toISOString() || null,
	};

	return {
		status: "success",
		prd: formattedPrd,
		projectId: prd.projectId,
		linkedSprints,
	};
}
