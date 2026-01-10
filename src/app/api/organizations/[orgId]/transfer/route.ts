import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const transferSchema = z.object({
	newOwnerMemberId: z.string().min(1, "New owner member ID is required"),
});

/**
 * POST /api/organizations/[orgId]/transfer
 * Transfer organization ownership to another member
 * Only the current owner can transfer ownership
 * This action is irreversible (without the new owner's consent)
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

		// Check user is the owner of this org
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
					error: "Only the organization owner can transfer ownership",
				},
				{ status: 403 },
			);
		}

		const body = await request.json();
		const parsed = transferSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					success: false,
					errors: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const { newOwnerMemberId } = parsed.data;

		// Verify the new owner exists and is a member of this org
		const newOwnerMembership = await prisma.organizationMember.findUnique({
			where: { id: newOwnerMemberId },
			include: {
				user: {
					select: { id: true, name: true, email: true },
				},
			},
		});

		if (!newOwnerMembership || newOwnerMembership.organizationId !== orgId) {
			return NextResponse.json(
				{
					success: false,
					error: "The selected member is not part of this organization",
				},
				{ status: 400 },
			);
		}

		if (newOwnerMembership.userId === session.user.id) {
			return NextResponse.json(
				{
					success: false,
					error: "You cannot transfer ownership to yourself",
				},
				{ status: 400 },
			);
		}

		// Perform the transfer in a transaction
		await prisma.$transaction([
			// Demote current owner to admin
			prisma.organizationMember.update({
				where: { id: currentMembership.id },
				data: { role: "admin" },
			}),
			// Promote new member to owner
			prisma.organizationMember.update({
				where: { id: newOwnerMemberId },
				data: { role: "owner" },
			}),
		]);

		return NextResponse.json({
			success: true,
			message: `Ownership transferred to ${newOwnerMembership.user.name || newOwnerMembership.user.email}`,
		});
	} catch (error) {
		console.error("Error transferring ownership:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to transfer ownership" },
			{ status: 500 },
		);
	}
}
