import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { orgRegistrationSchema } from "@/lib/auth/registration";

/**
 * POST /api/register
 * Complete organization registration with owner account
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const parsed = orgRegistrationSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					success: false,
					errors: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 }
			);
		}

		const { orgName, orgSlug, email, password, name } = parsed.data;

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

		// Check if email is already registered
		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			return NextResponse.json(
				{
					success: false,
					errors: {
						email: ["An account with this email already exists"],
					},
				},
				{ status: 400 }
			);
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 12);

		// Create organization, user, and membership in a transaction
		const result = await prisma.$transaction(async (tx) => {
			// Get or create the free plan
			let freePlan = await tx.plan.findUnique({
				where: { name: "free" },
			});

			if (!freePlan) {
				freePlan = await tx.plan.create({
					data: {
						name: "free",
						displayName: "Free",
						description: "Free tier with basic features",
						maxUsers: 3,
						maxProjects: 2,
						maxAiRunsPerWeek: 10,
						maxIterationsPerRun: 5,
						monthlyPriceCents: 0,
						yearlyPriceCents: 0,
						featuresJson: JSON.stringify({
							aiAssistant: true,
							kanbanBoard: true,
							sprintPlanning: true,
							teamCollaboration: false,
							advancedReporting: false,
							prioritySupport: false,
						}),
					},
				});
			}

			// Create user
			const user = await tx.user.create({
				data: {
					email,
					name,
					passwordHash,
					emailVerified: false,
				},
			});

			// Create organization
			const organization = await tx.organization.create({
				data: {
					name: orgName,
					slug: orgSlug,
				},
			});

			// Create membership (owner role)
			await tx.organizationMember.create({
				data: {
					organizationId: organization.id,
					userId: user.id,
					role: "owner",
				},
			});

			// Create subscription (free plan)
			const now = new Date();
			const periodEnd = new Date(now);
			periodEnd.setMonth(periodEnd.getMonth() + 1);

			await tx.subscription.create({
				data: {
					organizationId: organization.id,
					planId: freePlan.id,
					status: "active",
					billingPeriod: "monthly",
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
				},
			});

			// Create default project
			const project = await tx.project.create({
				data: {
					organizationId: organization.id,
					name: "My Project",
					slug: "my-project",
					description: "Your first project - a showcase of Ralph's features",
				},
			});

			// Create project settings
			await tx.projectSettings.create({
				data: {
					projectId: project.id,
					projectName: "My Project",
					projectDescription: "Your first project - update this with your project details",
					techStackJson: JSON.stringify([]),
					howToTestJson: JSON.stringify({ commands: [], notes: "" }),
					howToRunJson: JSON.stringify({ commands: [], notes: "" }),
					aiPreferencesJson: JSON.stringify({ defaultModel: "gpt-4" }),
					repoConventionsJson: JSON.stringify({ folders: {}, naming: "" }),
				},
			});

			// Create "First Steps" sprint
			const sprintDeadline = new Date();
			sprintDeadline.setDate(sprintDeadline.getDate() + 14); // 2 weeks from now

			const sprint = await tx.sprint.create({
				data: {
					projectId: project.id,
					name: "First Steps",
					goal: "Get familiar with Ralph and set up your project",
					deadline: sprintDeadline,
					status: "active",
				},
			});

			// Create sprint columns
			const columns = [
				{ columnId: "backlog", name: "Backlog", order: 0 },
				{ columnId: "todo", name: "To Do", order: 1 },
				{ columnId: "in_progress", name: "In Progress", order: 2 },
				{ columnId: "review", name: "Review", order: 3 },
				{ columnId: "done", name: "Done", order: 4 },
			];

			for (const col of columns) {
				await tx.sprintColumn.create({
					data: {
						sprintId: sprint.id,
						columnId: col.columnId,
						name: col.name,
						order: col.order,
					},
				});
			}

			// Create example tasks
			const exampleTasks = [
				{
					category: "setup",
					title: "Update Project Settings",
					description: "Configure your project settings with the correct information",
					acceptanceCriteria: [
						"Add your repository URL",
						"Define your tech stack",
						"Add instructions on how to run and test the project",
					],
					priority: "high",
				},
				{
					category: "planning",
					title: "Create Your First Sprint",
					description: "Plan your first real sprint with features to implement",
					acceptanceCriteria: [
						"Define the sprint goal",
						"Add tasks for features you want to build",
						"Set realistic deadlines",
					],
					priority: "medium",
				},
				{
					category: "profile",
					title: "Complete Your Profile",
					description: "Add your profile picture and personal details",
					acceptanceCriteria: [
						"Upload a profile picture",
						"Verify your email address",
						"Invite team members if applicable",
					],
					priority: "low",
				},
			];

			for (const task of exampleTasks) {
				await tx.task.create({
					data: {
						projectId: project.id,
						sprintId: sprint.id,
						category: task.category,
						title: task.title,
						description: task.description,
						acceptanceCriteriaJson: JSON.stringify(task.acceptanceCriteria),
						status: "todo",
						priority: task.priority,
						createdById: user.id,
					},
				});
			}

			return { user, organization, project };
		});

		return NextResponse.json({
			success: true,
			message: "Registration successful",
			data: {
				userId: result.user.id,
				organizationId: result.organization.id,
				organizationSlug: result.organization.slug,
			},
		});
	} catch (error) {
		console.error("Registration error:", error);
		return NextResponse.json(
			{
				success: false,
				errors: { _form: ["An unexpected error occurred during registration"] },
			},
			{ status: 500 }
		);
	}
}
