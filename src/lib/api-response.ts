import { NextResponse } from "next/server";

export type ErrorCode =
	| "UNAUTHORIZED"
	| "ACCESS_DENIED"
	| "NOT_FOUND"
	| "PROJECT_NOT_FOUND"
	| "SPRINT_NOT_FOUND"
	| "TASK_NOT_FOUND"
	| "PRD_NOT_FOUND"
	| "RUN_NOT_FOUND"
	| "INVALID_REQUEST"
	| "VALIDATION_ERROR"
	| "RATE_LIMIT_EXCEEDED"
	| "INTERNAL_ERROR";

interface ApiErrorOptions {
	status?: number;
	details?: string;
}

export function apiError(
	message: string,
	code: ErrorCode,
	options: ApiErrorOptions = {},
): NextResponse {
	const { status = 400, details } = options;

	const body: { error: string; code: ErrorCode; details?: string } = {
		error: message,
		code,
	};

	if (details) {
		body.details = details;
	}

	return NextResponse.json(body, { status });
}

export function unauthorized(message = "Unauthorized"): NextResponse {
	return apiError(message, "UNAUTHORIZED", { status: 401 });
}

export function accessDenied(message = "Access denied"): NextResponse {
	return apiError(message, "ACCESS_DENIED", { status: 403 });
}

export function notFound(
	resource: string,
	code: ErrorCode = "NOT_FOUND",
): NextResponse {
	return apiError(`${resource} not found`, code, { status: 404 });
}

export function invalidRequest(
	message: string,
	details?: string,
): NextResponse {
	return apiError(message, "INVALID_REQUEST", { status: 400, details });
}

export function validationError(
	errors: Record<string, string[]>,
): NextResponse {
	return NextResponse.json(
		{
			error: "Validation failed",
			code: "VALIDATION_ERROR",
			errors,
		},
		{ status: 400 },
	);
}

export function internalError(message = "Internal server error"): NextResponse {
	return apiError(message, "INTERNAL_ERROR", { status: 500 });
}
