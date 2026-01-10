import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/organizations/[orgId]/subscription
 * Get subscription details for an organization
 * Any member can read
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

		// Check user is a member of this org
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: orgId,
					userId: session.user.id,
				},
			},
		});

		if (!membership) {
			return NextResponse.json(
				{ success: false, error: "You don't have access to this organization" },
				{ status: 403 },
			);
		}

		const organization = await prisma.organization.findUnique({
			where: { id: orgId, deletedAt: null },
			select: { id: true, name: true },
		});

		if (!organization) {
			return NextResponse.json(
				{ success: false, error: "Organization not found" },
				{ status: 404 },
			);
		}

		// Get subscription with plan details
		const subscription = await prisma.subscription.findUnique({
			where: { organizationId: orgId },
			include: {
				plan: true,
			},
		});

		// Get all available plans for comparison/upgrade
		const allPlans = await prisma.plan.findMany({
			where: { isActive: true },
			orderBy: { monthlyPriceCents: "asc" },
		});

		// Get current usage stats
		const [memberCount, projectCount, aiRunsThisWeek] = await Promise.all([
			prisma.organizationMember.count({
				where: { organizationId: orgId },
			}),
			prisma.project.count({
				where: { organizationId: orgId, deletedAt: null },
			}),
			prisma.run.count({
				where: {
					project: {
						organizationId: orgId,
					},
					startedAt: {
						gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
					},
				},
			}),
		]);

		return NextResponse.json({
			success: true,
			organization: {
				id: organization.id,
				name: organization.name,
			},
			subscription: subscription
				? {
						id: subscription.id,
						status: subscription.status,
						billingPeriod: subscription.billingPeriod,
						currentPeriodStart: subscription.currentPeriodStart.toISOString(),
						currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
						trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
						canceledAt: subscription.canceledAt?.toISOString() || null,
						featureOverrides: JSON.parse(
							subscription.featureOverridesJson || "{}",
						),
						createdAt: subscription.createdAt.toISOString(),
						plan: {
							id: subscription.plan.id,
							name: subscription.plan.name,
							displayName: subscription.plan.displayName,
							description: subscription.plan.description,
							maxUsers: subscription.plan.maxUsers,
							maxProjects: subscription.plan.maxProjects,
							maxAiRunsPerWeek: subscription.plan.maxAiRunsPerWeek,
							maxIterationsPerRun: subscription.plan.maxIterationsPerRun,
							monthlyPriceCents: subscription.plan.monthlyPriceCents,
							yearlyPriceCents: subscription.plan.yearlyPriceCents,
							features: JSON.parse(subscription.plan.featuresJson || "{}"),
						},
					}
				: null,
			usage: {
				members: memberCount,
				projects: projectCount,
				aiRunsThisWeek: aiRunsThisWeek,
			},
			availablePlans: allPlans.map((plan) => ({
				id: plan.id,
				name: plan.name,
				displayName: plan.displayName,
				description: plan.description,
				maxUsers: plan.maxUsers,
				maxProjects: plan.maxProjects,
				maxAiRunsPerWeek: plan.maxAiRunsPerWeek,
				maxIterationsPerRun: plan.maxIterationsPerRun,
				monthlyPriceCents: plan.monthlyPriceCents,
				yearlyPriceCents: plan.yearlyPriceCents,
				features: JSON.parse(plan.featuresJson || "{}"),
			})),
			currentUserRole: membership.role,
		});
	} catch (error) {
		console.error("Error fetching subscription:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch subscription" },
			{ status: 500 },
		);
	}
}
