import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/api-keys";

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
 * Internal auth user representation - unified regardless of auth method.
 * Routes never see this; they only get ProjectContext.
 */
interface AuthUser {
	id: string;
	// Scoping restrictions from API key (null if session auth or unscoped key)
	scopedProjectId: string | null;
	scopedSprintId: string | null;
	scopedRunId: string | null;
}

/**
 * Internal: Resolve user from session or API key.
 * This abstracts away the auth method - routes don't need to know.
 */
async function getAuthUser(request: Request): Promise<AuthUser> {
	// Try session auth first
	const session = await auth();
	if (session?.user?.id) {
		return {
			id: session.user.id,
			scopedProjectId: null,
			scopedSprintId: null,
			scopedRunId: null,
		};
	}

	// Try API key auth
	const authHeader = request.headers.get("Authorization");
	const apiKey = await validateApiKey(authHeader);
	if (apiKey) {
		return {
			id: apiKey.userId,
			scopedProjectId: apiKey.projectId,
			scopedSprintId: apiKey.sprintId,
			scopedRunId: apiKey.runId,
		};
	}

	throw new UnauthorizedError();
}

/**
 * Core implementation for resolving project context.
 */
async function resolveProjectContext(
	projectId: string,
	authUser: AuthUser,
): Promise<ProjectContext> {
	// Check API key scope restriction
	if (authUser.scopedProjectId && authUser.scopedProjectId !== projectId) {
		throw new AccessDeniedError("Token not authorized for this project");
	}

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
				userId: authUser.id,
			},
		},
	});

	if (!membership) {
		throw new AccessDeniedError();
	}

	return {
		project,
		userId: authUser.id,
		organizationId: project.organizationId,
	};
}

/**
 * Resolves project from request, validating auth and access.
 * Supports both session auth and API key auth transparently.
 * Requires projectId query param.
 */
export async function getProjectContext(
	request: Request,
): Promise<ProjectContext> {
	const authUser = await getAuthUser(request);

	// Get project ID from query params
	const url = new URL(request.url);
	const projectId = url.searchParams.get(PROJECT_QUERY_PARAM);

	if (!projectId) {
		throw new ProjectNotFoundError("missing");
	}

	return resolveProjectContext(projectId, authUser);
}

/**
 * Resolves project from URL params (for nested routes like /api/projects/[id]/...).
 * Supports both session auth and API key auth transparently.
 * Takes project ID directly from route params.
 */
export async function getProjectContextFromParams(
	projectId: string,
	request: Request,
): Promise<ProjectContext> {
	const authUser = await getAuthUser(request);

	if (!projectId) {
		throw new ProjectNotFoundError("missing");
	}

	return resolveProjectContext(projectId, authUser);
}

/**
 * Handle common project route errors with proper HTTP responses.
 */
export function handleProjectRouteError(error: unknown) {
	if (error instanceof UnauthorizedError) {
		return NextResponse.json(
			{ error: "Unauthorized", code: "UNAUTHORIZED" },
			{ status: 401 },
		);
	}

	if (error instanceof AccessDeniedError) {
		return NextResponse.json(
			{ error: "Access denied", code: "ACCESS_DENIED" },
			{ status: 403 },
		);
	}

	if (error instanceof ProjectNotFoundError) {
		return NextResponse.json(
			{
				error: "Project not found",
				code: "PROJECT_NOT_FOUND",
				projectId: error.projectId,
			},
			{ status: 404 },
		);
	}

	console.error("Unhandled project route error:", error);
	return NextResponse.json(
		{ error: "Internal server error", code: "INTERNAL_ERROR" },
		{ status: 500 },
	);
}
