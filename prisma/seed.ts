import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma";

const adapter = new PrismaBetterSqlite3({
	url: process.env.DATABASE_URL ?? "file:./ralph.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
	console.log("Seeding database...");

	// ============================================================================
	// PLANS
	// ============================================================================

	const freePlan = await prisma.plan.upsert({
		where: { name: "free" },
		update: {},
		create: {
			name: "free",
			displayName: "Free",
			description: "Perfect for trying out Ralph with small projects",
			maxUsers: 2,
			maxProjects: 1,
			maxAiRunsPerWeek: 10,
			maxIterationsPerRun: 5,
			monthlyPriceCents: 0,
			yearlyPriceCents: 0,
			featuresJson: JSON.stringify({
				byokEnabled: false,
				prioritySupport: false,
				customBranding: false,
				advancedAnalytics: false,
				allowedAgents: ["free-agents"],
				ssoEnabled: false,
				auditLogs: false,
				apiAccess: false,
				maxFileSize: 5242880, // 5MB
			}),
		},
	});
	console.log("Created plan:", freePlan.displayName);

	const proPlan = await prisma.plan.upsert({
		where: { name: "pro" },
		update: {},
		create: {
			name: "pro",
			displayName: "Pro",
			description: "For professional developers and small teams",
			maxUsers: 10,
			maxProjects: 10,
			maxAiRunsPerWeek: 100,
			maxIterationsPerRun: 15,
			monthlyPriceCents: 7900, // $79
			yearlyPriceCents: 79000, // $790 (2 months free)
			featuresJson: JSON.stringify({
				byokEnabled: false,
				prioritySupport: true,
				customBranding: false,
				advancedAnalytics: true,
				allowedAgents: ["all"],
				ssoEnabled: false,
				auditLogs: true,
				apiAccess: true,
				maxFileSize: 52428800, // 50MB
			}),
		},
	});
	console.log("Created plan:", proPlan.displayName);

	const enterprisePlan = await prisma.plan.upsert({
		where: { name: "enterprise" },
		update: {},
		create: {
			name: "enterprise",
			displayName: "Enterprise",
			description:
				"For large teams with advanced security and compliance needs",
			maxUsers: 50,
			maxProjects: null, // Unlimited
			maxAiRunsPerWeek: 500,
			maxIterationsPerRun: 25,
			monthlyPriceCents: 29900, // $299
			yearlyPriceCents: 299000, // $2990 (2 months free)
			featuresJson: JSON.stringify({
				byokEnabled: false,
				prioritySupport: true,
				customBranding: true,
				advancedAnalytics: true,
				allowedAgents: ["all"],
				ssoEnabled: true,
				auditLogs: true,
				apiAccess: true,
				maxFileSize: null, // Unlimited
			}),
		},
	});
	console.log("Created plan:", enterprisePlan.displayName);

	// ============================================================================
	// FOUNDER USER & ORGANIZATION
	// ============================================================================

	const joao = await prisma.user.upsert({
		where: { email: "jllf.17@gmail.com" },
		update: {},
		create: {
			email: "jllf.17@gmail.com",
			name: "João Furtado",
			emailVerified: true,
		},
	});
	console.log("Created user:", joao.name);

	const founderOrg = await prisma.organization.upsert({
		where: { slug: "furtado-interactive" },
		update: {},
		create: {
			name: "Furtado Interactive, Unipessoal Lda.",
			slug: "furtado-interactive",
		},
	});
	console.log("Created organization:", founderOrg.name);

	// Add João as owner of the organization
	await prisma.organizationMember.upsert({
		where: {
			organizationId_userId: {
				organizationId: founderOrg.id,
				userId: joao.id,
			},
		},
		update: { role: "owner" },
		create: {
			organizationId: founderOrg.id,
			userId: joao.id,
			role: "owner",
		},
	});
	console.log("Added", joao.name, "as owner of", founderOrg.name);

	// ============================================================================
	// FOUNDER SUBSCRIPTION (Zero-cost Enterprise with BYOK)
	// ============================================================================

	const now = new Date();
	const farFuture = new Date("2099-12-31");

	await prisma.subscription.upsert({
		where: { organizationId: founderOrg.id },
		update: {},
		create: {
			organizationId: founderOrg.id,
			planId: enterprisePlan.id,
			status: "active",
			billingPeriod: "yearly",
			currentPeriodStart: now,
			currentPeriodEnd: farFuture,
			featureOverridesJson: JSON.stringify({
				byokEnabled: true, // BYOK enabled - unlimited runs with own API keys
				founderPlan: true, // Special founder subscription - zero cost
			}),
		},
	});
	console.log("Created founder subscription (Enterprise + BYOK, zero-cost)");

	console.log("\nSeeding complete!");
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
