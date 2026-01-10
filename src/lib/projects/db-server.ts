import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const PROJECT_QUERY_PARAM = "projectId";

export class ProjectNotFoundError extends Error {
	constructor(public projectId: string) {
		super(`Project with id ${projectId} was not found`);
		this.name = "ProjectNotFoundError";
	}
}

export class AccessDeniedError extends Error {
	constructor(message = "Access denied") {
		super(message);
		this.name = "AccessDeniedError";
	}
}

export class UnauthorizedError extends Error {
	constructor(message = "Unauthorized") {
		super(message);
		this.name = "UnauthorizedError";
	}
}

export interface ProjectContext {
	project: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		organizationId: string;
		repoUrl: string | null;
		repoBranch: string | null;
	};
	userId: string;
	organizationId: string;
}

/**
 * Core implementation for resolving project context.
 */
async function resolveProjectContext(
	projectId: string,
	userId: string
): Promise<ProjectContext> {
	// Fetch project
	const project = await prisma.project.findUnique({
		where: { id: projectId, deletedAt: null },
		select: {
			id: true,
			name: true,
			slug: true,
			description: true,
			organizationId: true,
			repoUrl: true,
			repoBranch: true,
		},
	});

	if (!project) {
		throw new ProjectNotFoundError(projectId);
	}

	// Verify user has access to this project's organization
	const membership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: project.organizationId,
				userId,
			},
		},
	});

	if (!membership) {
		throw new AccessDeniedError();
	}

	return {
		project,
		userId,
		organizationId: project.organizationId,
	};
}

/**
 * Resolves project from request, validating auth and access.
 * Requires projectId query param and valid session.
 */
export async function getProjectContext(
	request: Request
): Promise<ProjectContext> {
	// Check auth
	const session = await auth();
	if (!session?.user?.id) {
		throw new UnauthorizedError();
	}

	// Get project ID from query params
	const url = new URL(request.url);
	const projectId = url.searchParams.get(PROJECT_QUERY_PARAM);

	if (!projectId) {
		throw new ProjectNotFoundError("missing");
	}

	return resolveProjectContext(projectId, session.user.id);
}

/**
 * Resolves project from URL params (for nested routes like /api/projects/[id]/...).
 * Takes project ID directly from route params.
 */
export async function getProjectContextFromParams(
	projectId: string
): Promise<ProjectContext> {
	// Check auth
	const session = await auth();
	if (!session?.user?.id) {
		throw new UnauthorizedError();
	}

	if (!projectId) {
		throw new ProjectNotFoundError("missing");
	}

	return resolveProjectContext(projectId, session.user.id);
}

/**
 * Handle common project route errors with proper HTTP responses.
 */
export function handleProjectRouteError(error: unknown) {
	if (error instanceof UnauthorizedError) {
		return NextResponse.json(
			{ error: "Unauthorized", code: "UNAUTHORIZED" },
			{ status: 401 }
		);
	}

	if (error instanceof AccessDeniedError) {
		return NextResponse.json(
			{ error: "Access denied", code: "ACCESS_DENIED" },
			{ status: 403 }
		);
	}

	if (error instanceof ProjectNotFoundError) {
		return NextResponse.json(
			{
				error: "Project not found",
				code: "PROJECT_NOT_FOUND",
				projectId: error.projectId,
			},
			{ status: 404 }
		);
	}

	console.error("Unhandled project route error:", error);
	return NextResponse.json(
		{ error: "Internal server error" },
		{ status: 500 }
	);
}
