import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/db";

export async function PUT(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	let body: { currentPassword?: string; newPassword: string };
	try {
		body = await request.json();
	} catch {
		return apiError("Invalid JSON body", "INVALID_REQUEST");
	}

	const { currentPassword, newPassword } = body;

	if (!newPassword || typeof newPassword !== "string") {
		return apiError("New password is required", "VALIDATION_ERROR");
	}

	if (newPassword.length < 8) {
		return apiError(
			"Password must be at least 8 characters",
			"VALIDATION_ERROR",
		);
	}

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
		select: { passwordHash: true },
	});

	if (!user) {
		return unauthorized();
	}

	// If user has an existing password, require current password verification
	if (user.passwordHash) {
		if (!currentPassword) {
			return apiError("Current password is required", "VALIDATION_ERROR");
		}

		const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
		if (!isValid) {
			return apiError("Current password is incorrect", "VALIDATION_ERROR");
		}
	}

	// Hash new password
	const passwordHash = await bcrypt.hash(newPassword, 12);

	await prisma.user.update({
		where: { id: session.user.id },
		data: { passwordHash },
	});

	return NextResponse.json({
		success: true,
		message: "Password updated successfully",
	});
}
