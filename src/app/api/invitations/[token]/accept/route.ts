import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const acceptInviteSchema = z.object({
	name: z
		.string()
		.min(2, "Name must be at least 2 characters")
		.max(100, "Name must be at most 100 characters"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
		.regex(/[a-z]/, "Password must contain at least one lowercase letter")
		.regex(/[0-9]/, "Password must contain at least one number"),
});

/**
 * GET /api/invitations/[token]/accept
 * Get invitation details for displaying the accept form
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ token: string }> }
) {
	try {
		const { token } = await params;

		const invitation = await prisma.invitation.findUnique({
			where: { token },
			include: {
				organization: {
					select: {
						name: true,
						slug: true,
					},
				},
			},
		});

		if (!invitation) {
			return NextResponse.json(
				{ success: false, error: "Invalid invitation" },
				{ status: 404 }
			);
		}

		if (invitation.acceptedAt) {
			return NextResponse.json(
				{ success: false, error: "This invitation has already been accepted" },
				{ status: 400 }
			);
		}

		if (invitation.expiresAt < new Date()) {
			return NextResponse.json(
				{ success: false, error: "This invitation has expired" },
				{ status: 400 }
			);
		}

		// Check if user already exists
		const existingUser = await prisma.user.findUnique({
			where: { email: invitation.email },
		});

		return NextResponse.json({
			success: true,
			data: {
				email: invitation.email,
				role: invitation.role,
				organization: {
					name: invitation.organization.name,
					slug: invitation.organization.slug,
				},
				userExists: !!existingUser,
			},
		});
	} catch (error) {
		console.error("Error fetching invitation:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch invitation" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/invitations/[token]/accept
 * Accept an invitation and create/link user account
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ token: string }> }
) {
	try {
		const { token } = await params;

		const invitation = await prisma.invitation.findUnique({
			where: { token },
			include: {
				organization: true,
			},
		});

		if (!invitation) {
			return NextResponse.json(
				{ success: false, error: "Invalid invitation" },
				{ status: 404 }
			);
		}

		if (invitation.acceptedAt) {
			return NextResponse.json(
				{ success: false, error: "This invitation has already been accepted" },
				{ status: 400 }
			);
		}

		if (invitation.expiresAt < new Date()) {
			return NextResponse.json(
				{ success: false, error: "This invitation has expired" },
				{ status: 400 }
			);
		}

		// Check if user already exists
		let user = await prisma.user.findUnique({
			where: { email: invitation.email },
		});

		if (user) {
			// User exists - just add them to the org
			await prisma.$transaction([
				prisma.organizationMember.create({
					data: {
						organizationId: invitation.organizationId,
						userId: user.id,
						role: invitation.role,
					},
				}),
				prisma.invitation.update({
					where: { id: invitation.id },
					data: { acceptedAt: new Date() },
				}),
			]);

			return NextResponse.json({
				success: true,
				message: "You have joined the organization",
				data: {
					organizationSlug: invitation.organization.slug,
				},
			});
		}

		// New user - need name and password
		const body = await request.json();
		const parsed = acceptInviteSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					success: false,
					errors: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 }
			);
		}

		const { name, password } = parsed.data;
		const passwordHash = await bcrypt.hash(password, 12);

		// Create user and membership in transaction
		await prisma.$transaction([
			prisma.user.create({
				data: {
					email: invitation.email,
					name,
					passwordHash,
					emailVerified: true, // Verified via invitation email
					memberships: {
						create: {
							organizationId: invitation.organizationId,
							role: invitation.role,
						},
					},
				},
			}),
			prisma.invitation.update({
				where: { id: invitation.id },
				data: { acceptedAt: new Date() },
			}),
		]);

		return NextResponse.json({
			success: true,
			message: "Account created and joined organization",
			data: {
				organizationSlug: invitation.organization.slug,
			},
		});
	} catch (error) {
		console.error("Error accepting invitation:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to accept invitation" },
			{ status: 500 }
		);
	}
}
