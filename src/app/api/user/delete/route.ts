import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/db";

export async function DELETE(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	let body: { password?: string; confirmation: string };
	try {
		body = await request.json();
	} catch {
		return apiError("Invalid JSON body", "INVALID_REQUEST");
	}

	const { password, confirmation } = body;

	if (confirmation !== "DELETE") {
		return apiError(
			"Please type DELETE to confirm account deletion",
			"VALIDATION_ERROR",
		);
	}

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
		select: {
			id: true,
			passwordHash: true,
			memberships: {
				select: {
					id: true,
					role: true,
					organizationId: true,
					organization: {
						select: {
							id: true,
							name: true,
							_count: {
								select: { members: true },
							},
						},
					},
				},
			},
		},
	});

	if (!user) {
		return unauthorized();
	}

	// If user has a password, require it for deletion
	if (user.passwordHash) {
		if (!password) {
			return apiError(
				"Password is required to delete account",
				"VALIDATION_ERROR",
			);
		}

		const isValid = await bcrypt.compare(password, user.passwordHash);
		if (!isValid) {
			return apiError("Password is incorrect", "VALIDATION_ERROR");
		}
	}

	// Check if user is owner of any organization
	const isOwner = user.memberships.some((m) => m.role === "owner");

	if (isOwner) {
		return apiError(
			"Organization owners cannot delete their account. Transfer ownership first.",
			"VALIDATION_ERROR",
		);
	}

	// Soft delete the user
	await prisma.user.update({
		where: { id: session.user.id },
		data: { deletedAt: new Date() },
	});

	return NextResponse.json({
		success: true,
		message: "Account deleted successfully",
	});
}
