import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { orgRegistrationStep1Schema } from "@/lib/auth/registration";

/**
 * POST /api/register/validate-step1
 * Validates organization details for step 1 of registration
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const parsed = orgRegistrationStep1Schema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					success: false,
					errors: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 }
			);
		}

		const { orgSlug } = parsed.data;

		// Check if organization slug is already taken
		const existingOrg = await prisma.organization.findUnique({
			where: { slug: orgSlug },
		});

		if (existingOrg) {
			return NextResponse.json(
				{
					success: false,
					errors: {
						orgSlug: ["This organization URL is already taken"],
					},
				},
				{ status: 400 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Organization details are valid",
		});
	} catch (error) {
		console.error("Registration step 1 validation error:", error);
		return NextResponse.json(
			{
				success: false,
				errors: { _form: ["An unexpected error occurred"] },
			},
			{ status: 500 }
		);
	}
}
