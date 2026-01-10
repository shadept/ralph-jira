import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/plans
 * List all available subscription plans (public endpoint)
 */
export async function GET() {
	try {
		const plans = await prisma.plan.findMany({
			where: { isActive: true },
			orderBy: { monthlyPriceCents: "asc" },
		});

		return NextResponse.json({
			success: true,
			data: plans.map((plan) => ({
				id: plan.id,
				name: plan.name,
				displayName: plan.displayName,
				description: plan.description,
				maxUsers: plan.maxUsers,
				maxProjects: plan.maxProjects,
				maxAiRunsPerWeek: plan.maxAiRunsPerWeek,
				maxIterationsPerRun: plan.maxIterationsPerRun,
				monthlyPrice: plan.monthlyPriceCents / 100,
				yearlyPrice: plan.yearlyPriceCents / 100,
				features: JSON.parse(plan.featuresJson),
			})),
		});
	} catch (error) {
		console.error("Error fetching plans:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch plans" },
			{ status: 500 }
		);
	}
}
