import { NextResponse } from "next/server";

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (entry.resetTime < now) {
			rateLimitStore.delete(key);
		}
	}
}, 60000); // Clean every minute

export interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
}

export const RATE_LIMITS = {
	// Strict limits for unauthenticated endpoints
	auth: { maxRequests: 5, windowMs: 60000 }, // 5 req/min for login/register
	// Standard limits for authenticated endpoints
	standard: { maxRequests: 60, windowMs: 60000 }, // 60 req/min (1/sec avg)
	// AI endpoints (more expensive)
	ai: { maxRequests: 20, windowMs: 60000 }, // 20 req/min
} as const;

export function checkRateLimit(
	identifier: string,
	config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetTime: number } {
	const now = Date.now();
	const key = identifier;

	const entry = rateLimitStore.get(key);

	if (!entry || entry.resetTime < now) {
		// Create new window
		rateLimitStore.set(key, {
			count: 1,
			resetTime: now + config.windowMs,
		});
		return {
			allowed: true,
			remaining: config.maxRequests - 1,
			resetTime: now + config.windowMs,
		};
	}

	if (entry.count >= config.maxRequests) {
		return {
			allowed: false,
			remaining: 0,
			resetTime: entry.resetTime,
		};
	}

	entry.count++;
	return {
		allowed: true,
		remaining: config.maxRequests - entry.count,
		resetTime: entry.resetTime,
	};
}

export function rateLimitResponse(resetTime: number): NextResponse {
	const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
	return NextResponse.json(
		{
			error: "Too many requests. Please try again later.",
			code: "RATE_LIMIT_EXCEEDED",
			retryAfter,
		},
		{
			status: 429,
			headers: {
				"Retry-After": String(retryAfter),
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": String(Math.ceil(resetTime / 1000)),
			},
		},
	);
}

export function getClientIdentifier(request: Request): string {
	// Use forwarded IP if behind proxy, otherwise use connection IP
	const forwarded = request.headers.get("x-forwarded-for");
	const realIp = request.headers.get("x-real-ip");
	const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
	return ip;
}

export function addRateLimitHeaders(
	response: NextResponse,
	remaining: number,
	resetTime: number,
): NextResponse {
	response.headers.set("X-RateLimit-Remaining", String(remaining));
	response.headers.set(
		"X-RateLimit-Reset",
		String(Math.ceil(resetTime / 1000)),
	);
	return response;
}
