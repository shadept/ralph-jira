import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateMemberSchema = z.object({
	role: z.enum(["owner", "admin", "member"]),
});

/**
 * PUT /api/organizations/[orgId]/members/[memberId]
 * Update a member's role
 * Only owners can update roles
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ orgId: string; memberId: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const { orgId, memberId } = await params;

		// Check user is an owner of this org
		const currentMembership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: orgId,
					userId: session.user.id,
				},
			},
		});

		if (!currentMembership || currentMembership.role !== "owner") {
			return NextResponse.json(
				{
					success: false,
					error: "Only organization owners can change member roles",
				},
				{ status: 403 },
			);
		}

		// Get the target member
		const targetMember = await prisma.organizationMember.findUnique({
			where: { id: memberId },
		});

		if (!targetMember || targetMember.organizationId !== orgId) {
			return NextResponse.json(
				{ success: false, error: "Member not found" },
				{ status: 404 },
			);
		}

		// Prevent removing the last owner
		if (targetMember.role === "owner") {
			const ownerCount = await prisma.organizationMember.count({
				where: {
					organizationId: orgId,
					role: "owner",
				},
			});

			if (ownerCount <= 1) {
				return NextResponse.json(
					{
						success: false,
						error:
							"Cannot change role of the last owner. Transfer ownership first.",
					},
					{ status: 400 },
				);
			}
		}

		const body = await request.json();
		const parsed = updateMemberSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					success: false,
					errors: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const { role } = parsed.data;

		const updatedMember = await prisma.organizationMember.update({
			where: { id: memberId },
			data: { role },
		});

		const user = await prisma.user.findUnique({
			where: { id: updatedMember.userId },
			select: {
				id: true,
				name: true,
				email: true,
				avatarUrl: true,
			},
		});

		return NextResponse.json({
			success: true,
			member: {
				id: updatedMember.id,
				userId: updatedMember.userId,
				role: updatedMember.role,
				joinedAt: updatedMember.joinedAt.toISOString(),
				user: {
					id: user?.id,
					name: user?.name,
					email: user?.email,
					image: user?.avatarUrl,
				},
			},
		});
	} catch (error) {
		console.error("Error updating member:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to update member" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/organizations/[orgId]/members/[memberId]
 * Remove a member from the organization
 * Owners can remove anyone, members can remove themselves
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ orgId: string; memberId: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const { orgId, memberId } = await params;

		// Check user's membership
		const currentMembership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: orgId,
					userId: session.user.id,
				},
			},
		});

		if (!currentMembership) {
			return NextResponse.json(
				{ success: false, error: "You don't have access to this organization" },
				{ status: 403 },
			);
		}

		// Get the target member
		const targetMember = await prisma.organizationMember.findUnique({
			where: { id: memberId },
		});

		if (!targetMember || targetMember.organizationId !== orgId) {
			return NextResponse.json(
				{ success: false, error: "Member not found" },
				{ status: 404 },
			);
		}

		// Check permissions: owners can remove anyone, others can only remove themselves
		const isOwner = currentMembership.role === "owner";
		const isSelf = targetMember.userId === session.user.id;

		if (!isOwner && !isSelf) {
			return NextResponse.json(
				{
					success: false,
					error: "Only organization owners can remove other members",
				},
				{ status: 403 },
			);
		}

		// Prevent removing the last owner
		if (targetMember.role === "owner") {
			const ownerCount = await prisma.organizationMember.count({
				where: {
					organizationId: orgId,
					role: "owner",
				},
			});

			if (ownerCount <= 1) {
				return NextResponse.json(
					{
						success: false,
						error: "Cannot remove the last owner. Transfer ownership first.",
					},
					{ status: 400 },
				);
			}
		}

		await prisma.organizationMember.delete({
			where: { id: memberId },
		});

		return NextResponse.json({
			success: true,
			message: isSelf
				? "You have left the organization"
				: "Member removed successfully",
		});
	} catch (error) {
		console.error("Error removing member:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to remove member" },
			{ status: 500 },
		);
	}
}
