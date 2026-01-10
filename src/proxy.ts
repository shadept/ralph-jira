import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
	checkRateLimit,
	getClientIdentifier,
	RATE_LIMITS,
	type RateLimitConfig,
	rateLimitResponse,
} from "@/lib/rate-limit";

// Public routes that don't require authentication
const publicRoutes = [
	"/",
	"/login",
	"/register",
	"/invite",
	"/api/auth",
	"/api/register",
	"/api/invitations",
	"/api/plans",
];

// Check if a path matches any public route
function isPublicRoute(path: string): boolean {
	return publicRoutes.some(
		(route) => path === route || path.startsWith(`${route}/`),
	);
}

// Static files and assets don't need auth check
function isStaticAsset(path: string): boolean {
	return (
		path.startsWith("/_next") ||
		path.startsWith("/favicon") ||
		path.includes(".") // files with extensions
	);
}

// Get rate limit config based on path
function getRateLimitConfig(pathname: string): RateLimitConfig | null {
	// Skip rate limiting for non-API routes
	if (!pathname.startsWith("/api/")) {
		return null;
	}

	// Strict limits for auth endpoints (unauthenticated)
	if (
		pathname === "/api/register" ||
		pathname.startsWith("/api/register/") ||
		pathname === "/api/auth/signin" ||
		pathname === "/api/auth/callback"
	) {
		return RATE_LIMITS.auth;
	}

	// AI endpoints need special limits
	if (pathname.startsWith("/api/ai/")) {
		return RATE_LIMITS.ai;
	}

	// Standard limits for all other API routes
	return RATE_LIMITS.standard;
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Skip static assets
	if (isStaticAsset(pathname)) {
		return NextResponse.next();
	}

	// Apply rate limiting for API routes
	const rateLimitConfig = getRateLimitConfig(pathname);
	if (rateLimitConfig) {
		const clientId = getClientIdentifier(request);
		const rateLimitKey = `${clientId}:${pathname.split("/").slice(0, 4).join("/")}`;

		const result = checkRateLimit(rateLimitKey, rateLimitConfig);

		if (!result.allowed) {
			return rateLimitResponse(result.resetTime);
		}
	}

	// Allow public routes
	if (isPublicRoute(pathname)) {
		const response = NextResponse.next();
		return response;
	}

	// Check authentication
	const session = await auth();

	if (!session?.user) {
		// For API routes, return 401
		if (pathname.startsWith("/api/")) {
			return NextResponse.json(
				{ error: "Unauthorized", code: "UNAUTHORIZED" },
				{ status: 401 },
			);
		}

		// For page routes, redirect to login
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		"/((?!_next/static|_next/image|favicon.ico).*)",
	],
};
