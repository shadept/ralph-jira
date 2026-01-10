import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { email } from "@/lib/email";

const inviteSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	role: z.enum(["admin", "member"]).default("member"),
});

/**
 * GET /api/organizations/[orgId]/invitations
 * List pending invitations for an organization
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ orgId: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const { orgId } = await params;

		// Check user is a member of this org with admin+ role
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: orgId,
					userId: session.user.id,
				},
			},
		});

		if (!membership || membership.role === "member") {
			return NextResponse.json(
				{
					success: false,
					error: "You don't have permission to view invitations",
				},
				{ status: 403 },
			);
		}

		const invitations = await prisma.invitation.findMany({
			where: {
				organizationId: orgId,
				acceptedAt: null,
				expiresAt: { gt: new Date() },
			},
			orderBy: { createdAt: "desc" },
		});

		return NextResponse.json({
			success: true,
			data: invitations.map((inv) => ({
				id: inv.id,
				email: inv.email,
				role: inv.role,
				expiresAt: inv.expiresAt.toISOString(),
				createdAt: inv.createdAt.toISOString(),
			})),
		});
	} catch (error) {
		console.error("Error fetching invitations:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch invitations" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/organizations/[orgId]/invitations
 * Send an invitation to join the organization
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ orgId: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const { orgId } = await params;

		// Check user is a member of this org with admin+ role
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: orgId,
					userId: session.user.id,
				},
			},
			include: {
				organization: true,
				user: true,
			},
		});

		if (!membership || membership.role === "member") {
			return NextResponse.json(
				{
					success: false,
					error: "You don't have permission to invite members",
				},
				{ status: 403 },
			);
		}

		const body = await request.json();
		const parsed = inviteSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					success: false,
					errors: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const { email: inviteeEmail, role } = parsed.data;

		// Check if user is already a member
		const existingUser = await prisma.user.findUnique({
			where: { email: inviteeEmail },
			include: {
				memberships: {
					where: { organizationId: orgId },
				},
			},
		});

		if (existingUser?.memberships.length) {
			return NextResponse.json(
				{
					success: false,
					error: "This user is already a member of your organization",
				},
				{ status: 400 },
			);
		}

		// Check for existing pending invitation
		const existingInvite = await prisma.invitation.findFirst({
			where: {
				organizationId: orgId,
				email: inviteeEmail,
				acceptedAt: null,
				expiresAt: { gt: new Date() },
			},
		});

		if (existingInvite) {
			return NextResponse.json(
				{
					success: false,
					error: "An invitation has already been sent to this email",
				},
				{ status: 400 },
			);
		}

		// Generate invitation token
		const token = randomBytes(32).toString("hex");
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

		// Create invitation
		const invitation = await prisma.invitation.create({
			data: {
				organizationId: orgId,
				email: inviteeEmail,
				role,
				token,
				expiresAt,
			},
		});

		// Send invitation email
		const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
		const inviteUrl = `${baseUrl}/invite/${token}`;

		await email().sendTemplate({
			to: inviteeEmail,
			template: "invitation",
			variables: {
				orgName: membership.organization.name,
				inviterName: membership.user.name || membership.user.email,
				inviteUrl,
			},
		});

		return NextResponse.json({
			success: true,
			message: "Invitation sent successfully",
			data: {
				id: invitation.id,
				email: inviteeEmail,
				role,
				expiresAt: expiresAt.toISOString(),
			},
		});
	} catch (error) {
		console.error("Error sending invitation:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to send invitation" },
			{ status: 500 },
		);
	}
}
