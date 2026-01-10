import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

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
		(route) => path === route || path.startsWith(`${route}/`)
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

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Skip static assets
	if (isStaticAsset(pathname)) {
		return NextResponse.next();
	}

	// Allow public routes
	if (isPublicRoute(pathname)) {
		return NextResponse.next();
	}

	// Check authentication
	const session = await auth();

	if (!session?.user) {
		// For API routes, return 401
		if (pathname.startsWith("/api/")) {
			return NextResponse.json(
				{ error: "Unauthorized", message: "Please log in to access this resource" },
				{ status: 401 }
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
