import { NextResponse } from "next/server";
import { apiError, unauthorized } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
		select: {
			id: true,
			email: true,
			name: true,
			avatarUrl: true,
			emailVerified: true,
			createdAt: true,
			lastLoginAt: true,
			passwordHash: true,
			memberships: {
				select: { role: true },
			},
		},
	});

	if (!user) {
		return unauthorized();
	}

	const isOrgOwner = user.memberships.some((m) => m.role === "owner");

	return NextResponse.json({
		success: true,
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			avatarUrl: user.avatarUrl,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
			lastLoginAt: user.lastLoginAt,
			hasPassword: !!user.passwordHash,
			isOrgOwner,
		},
	});
}

export async function PUT(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	let body: { name?: string };
	try {
		body = await request.json();
	} catch {
		return apiError("Invalid JSON body", "INVALID_REQUEST");
	}

	const { name } = body;

	if (name !== undefined && typeof name !== "string") {
		return apiError("Name must be a string", "VALIDATION_ERROR");
	}

	if (name !== undefined && name.trim().length === 0) {
		return apiError("Name cannot be empty", "VALIDATION_ERROR");
	}

	if (name !== undefined && name.length > 100) {
		return apiError("Name must be 100 characters or less", "VALIDATION_ERROR");
	}

	const updatedUser = await prisma.user.update({
		where: { id: session.user.id },
		data: {
			...(name !== undefined && { name: name.trim() }),
		},
		select: {
			id: true,
			email: true,
			name: true,
			avatarUrl: true,
			emailVerified: true,
			createdAt: true,
			lastLoginAt: true,
			passwordHash: true,
		},
	});

	return NextResponse.json({
		success: true,
		user: {
			id: updatedUser.id,
			email: updatedUser.email,
			name: updatedUser.name,
			avatarUrl: updatedUser.avatarUrl,
			emailVerified: updatedUser.emailVerified,
			createdAt: updatedUser.createdAt,
			lastLoginAt: updatedUser.lastLoginAt,
			hasPassword: !!updatedUser.passwordHash,
		},
	});
}
