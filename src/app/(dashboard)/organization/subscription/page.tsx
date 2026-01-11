import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
	NoSubscription,
	SubscriptionClient,
	type SubscriptionData,
} from "./subscription-client";

async function getSubscriptionData(
	userId: string,
): Promise<SubscriptionData | null> {
	// Get user's first organization membership
	const membership = await prisma.organizationMember.findFirst({
		where: { userId },
		orderBy: { joinedAt: "asc" },
		select: {
			role: true,
			organizationId: true,
			organization: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	if (!membership) {
		return null;
	}

	const orgId = membership.organizationId;

	// Get subscription with plan
	const subscription = await prisma.subscription.findUnique({
		where: { organizationId: orgId },
		include: { plan: true },
	});

	// Get usage counts
	const [memberCount, projectCount, aiRunsThisWeek] = await Promise.all([
		prisma.organizationMember.count({
			where: { organizationId: orgId },
		}),
		prisma.project.count({
			where: { organizationId: orgId, deletedAt: null },
		}),
		prisma.run.count({
			where: {
				project: { organizationId: orgId },
				startedAt: {
					gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
				},
			},
		}),
	]);

	// Get available plans
	const availablePlans = await prisma.plan.findMany({
		where: { isActive: true },
		orderBy: { monthlyPriceCents: "asc" },
	});

	return {
		organization: {
			id: membership.organization.id,
			name: membership.organization.name,
		},
		subscription: subscription
			? {
					id: subscription.id,
					status: subscription.status,
					billingPeriod: subscription.billingPeriod,
					currentPeriodStart: subscription.currentPeriodStart.toISOString(),
					currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
					trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
					cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
					canceledAt: subscription.canceledAt?.toISOString() ?? null,
					featureOverrides: JSON.parse(
						subscription.featureOverridesJson || "{}",
					) as Record<string, unknown>,
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
						features: JSON.parse(
							subscription.plan.featuresJson || "{}",
						) as Record<string, unknown>,
					},
				}
			: null,
		usage: {
			members: memberCount,
			projects: projectCount,
			aiRunsThisWeek,
		},
		availablePlans: availablePlans.map((p) => ({
			id: p.id,
			name: p.name,
			displayName: p.displayName,
			description: p.description,
			maxUsers: p.maxUsers,
			maxProjects: p.maxProjects,
			maxAiRunsPerWeek: p.maxAiRunsPerWeek,
			maxIterationsPerRun: p.maxIterationsPerRun,
			monthlyPriceCents: p.monthlyPriceCents,
			yearlyPriceCents: p.yearlyPriceCents,
			features: JSON.parse(p.featuresJson || "{}") as Record<string, unknown>,
		})),
		currentUserRole: membership.role as "owner" | "admin" | "member",
	};
}

export default async function SubscriptionPage() {
	const session = await auth();
	const data = await getSubscriptionData(session!.user!.id);

	if (!data) {
		return <NoSubscription />;
	}

	return <SubscriptionClient initialData={data} />;
}
