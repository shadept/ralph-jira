import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
	url: process.env.DATABASE_URL ?? "file:./prisma/ralph.db",
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

	// ============================================================================
	// TEST ORGANIZATION WITH LOTS OF DATA
	// ============================================================================

	// Create test users - Alice is the owner with login credentials
	const testPassword = "Test1234"; // Password for all test users
	const hashedPassword = await bcrypt.hash(testPassword, 10);

	const testUsers = [
		{ email: "alice@acme.test", name: "Alice Johnson", isOwner: true },
		{ email: "bob@acme.test", name: "Bob Smith", isOwner: false },
		{ email: "charlie@acme.test", name: "Charlie Brown", isOwner: false },
		{ email: "diana@acme.test", name: "Diana Prince", isOwner: false },
		{ email: "eve@acme.test", name: "Eve Wilson", isOwner: false },
		{ email: "frank@acme.test", name: "Frank Castle", isOwner: false },
		{ email: "grace@acme.test", name: "Grace Hopper", isOwner: false },
		{ email: "henry@acme.test", name: "Henry Ford", isOwner: false },
		{ email: "iris@acme.test", name: "Iris West", isOwner: false },
		{ email: "jack@acme.test", name: "Jack Sparrow", isOwner: false },
	];

	const createdTestUsers = [];
	for (const user of testUsers) {
		const created = await prisma.user.upsert({
			where: { email: user.email },
			update: { passwordHash: hashedPassword },
			create: {
				email: user.email,
				name: user.name,
				emailVerified: true,
				passwordHash: hashedPassword,
			},
		});
		createdTestUsers.push(created);
	}
	console.log("Created", createdTestUsers.length, "test users");
	console.log("Test login: alice@acme.test / Test1234");

	// Create test organization
	const acmeOrg = await prisma.organization.upsert({
		where: { slug: "acme-corp" },
		update: {},
		create: {
			name: "Acme Corporation",
			slug: "acme-corp",
		},
	});
	console.log("Created organization:", acmeOrg.name);

	// Add all test users to the organization with different roles
	const roles = ["owner", "admin", "member", "member", "member", "member", "member", "member", "viewer", "viewer"];
	for (let i = 0; i < createdTestUsers.length; i++) {
		await prisma.organizationMember.upsert({
			where: {
				organizationId_userId: {
					organizationId: acmeOrg.id,
					userId: createdTestUsers[i].id,
				},
			},
			update: { role: roles[i] },
			create: {
				organizationId: acmeOrg.id,
				userId: createdTestUsers[i].id,
				role: roles[i],
			},
		});
	}
	console.log("Added all test users to Acme Corp");

	// Create Pro subscription for Acme
	await prisma.subscription.upsert({
		where: { organizationId: acmeOrg.id },
		update: {},
		create: {
			organizationId: acmeOrg.id,
			planId: proPlan.id,
			status: "active",
			billingPeriod: "monthly",
			currentPeriodStart: now,
			currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
		},
	});
	console.log("Created Pro subscription for Acme Corp");

	// ============================================================================
	// TEST PROJECTS
	// ============================================================================

	const projectsData = [
		{
			name: "Phoenix Platform",
			slug: "phoenix-platform",
			description: "Next-generation cloud platform with microservices architecture",
			techStack: ["TypeScript", "Node.js", "React", "PostgreSQL", "Redis", "Docker", "Kubernetes"],
		},
		{
			name: "Mobile App",
			slug: "mobile-app",
			description: "Cross-platform mobile application for iOS and Android",
			techStack: ["React Native", "TypeScript", "Expo", "Firebase", "GraphQL"],
		},
		{
			name: "Data Pipeline",
			slug: "data-pipeline",
			description: "Real-time data processing and analytics pipeline",
			techStack: ["Python", "Apache Kafka", "Apache Spark", "Airflow", "Snowflake"],
		},
		{
			name: "Marketing Website",
			slug: "marketing-website",
			description: "Company marketing website with CMS integration",
			techStack: ["Next.js", "Tailwind CSS", "Sanity CMS", "Vercel"],
		},
		{
			name: "Internal Tools",
			slug: "internal-tools",
			description: "Suite of internal productivity and admin tools",
			techStack: ["Vue.js", "Python", "FastAPI", "PostgreSQL"],
		},
		{
			name: "API Gateway",
			slug: "api-gateway",
			description: "Centralized API gateway and authentication service",
			techStack: ["Go", "gRPC", "Redis", "JWT", "OAuth2"],
		},
		{
			name: "ML Platform",
			slug: "ml-platform",
			description: "Machine learning model training and deployment platform",
			techStack: ["Python", "PyTorch", "MLflow", "Kubeflow", "S3"],
		},
		{
			name: "Customer Portal",
			slug: "customer-portal",
			description: "Self-service customer portal with billing integration",
			techStack: ["React", "TypeScript", "Stripe", "Node.js", "MongoDB"],
		},
	];

	const createdProjects = [];
	for (const proj of projectsData) {
		const existing = await prisma.project.findFirst({
			where: { organizationId: acmeOrg.id, slug: proj.slug },
		});

		if (!existing) {
			const project = await prisma.project.create({
				data: {
					organizationId: acmeOrg.id,
					name: proj.name,
					slug: proj.slug,
					description: proj.description,
				},
			});

			await prisma.projectSettings.create({
				data: {
					projectId: project.id,
					projectName: proj.name,
					projectDescription: proj.description,
					techStackJson: JSON.stringify(proj.techStack),
					howToTestJson: JSON.stringify({ commands: ["npm test", "npm run e2e"], notes: "Run all tests before merging" }),
					howToRunJson: JSON.stringify({ commands: ["npm install", "npm run dev"], notes: "Requires Node 20+" }),
					aiPreferencesJson: JSON.stringify({ defaultModel: "gpt-4" }),
					repoConventionsJson: JSON.stringify({ folders: { src: "Source code", tests: "Test files" }, naming: "camelCase" }),
				},
			});

			createdProjects.push(project);
		} else {
			createdProjects.push(existing);
		}
	}
	console.log("Created", createdProjects.length, "test projects");

	// ============================================================================
	// TEST SPRINTS & TASKS
	// ============================================================================

	const sprintNames = [
		{ name: "Sprint 1 - Foundation", goal: "Set up core infrastructure and basic features", status: "completed" },
		{ name: "Sprint 2 - MVP", goal: "Complete minimum viable product features", status: "completed" },
		{ name: "Sprint 3 - Beta Launch", goal: "Prepare for beta testing and feedback", status: "active" },
		{ name: "Sprint 4 - Polish", goal: "Bug fixes and UX improvements", status: "planned" },
		{ name: "Sprint 5 - Scale", goal: "Performance optimization and scaling", status: "planned" },
	];

	const taskCategories = ["feature", "bug", "chore", "docs", "refactor", "test", "design", "research"];
	const taskStatuses = ["backlog", "todo", "in_progress", "review", "done"];
	const priorities = ["low", "medium", "high", "critical"];

	const taskTemplates = [
		{ title: "Implement user authentication", description: "Add login, registration, and password reset flows", category: "feature" },
		{ title: "Set up CI/CD pipeline", description: "Configure GitHub Actions for automated testing and deployment", category: "chore" },
		{ title: "Design system components", description: "Create reusable UI components with Storybook", category: "design" },
		{ title: "API rate limiting", description: "Implement rate limiting to prevent abuse", category: "feature" },
		{ title: "Fix memory leak in worker", description: "Investigate and fix memory leak in background worker process", category: "bug" },
		{ title: "Database migrations", description: "Create migration scripts for schema changes", category: "chore" },
		{ title: "Unit test coverage", description: "Increase unit test coverage to 80%", category: "test" },
		{ title: "API documentation", description: "Write OpenAPI spec and generate documentation", category: "docs" },
		{ title: "Refactor auth module", description: "Improve code structure and reduce duplication", category: "refactor" },
		{ title: "Research caching strategies", description: "Evaluate Redis vs Memcached for our use case", category: "research" },
		{ title: "Implement search functionality", description: "Add full-text search with Elasticsearch", category: "feature" },
		{ title: "Fix pagination bug", description: "Pagination returns duplicate items on edge cases", category: "bug" },
		{ title: "Add logging middleware", description: "Implement structured logging for all API requests", category: "chore" },
		{ title: "Create onboarding flow", description: "Design and implement new user onboarding experience", category: "design" },
		{ title: "Performance profiling", description: "Profile slow endpoints and identify bottlenecks", category: "research" },
		{ title: "Implement webhooks", description: "Add webhook support for external integrations", category: "feature" },
		{ title: "Fix timezone handling", description: "Dates display incorrectly for non-UTC users", category: "bug" },
		{ title: "Security audit", description: "Review code for common security vulnerabilities", category: "chore" },
		{ title: "E2E test suite", description: "Set up Playwright for end-to-end testing", category: "test" },
		{ title: "Deployment documentation", description: "Document deployment process and runbooks", category: "docs" },
		{ title: "Implement notifications", description: "Add in-app and email notifications", category: "feature" },
		{ title: "Fix race condition", description: "Race condition in concurrent order processing", category: "bug" },
		{ title: "Database optimization", description: "Add indexes and optimize slow queries", category: "refactor" },
		{ title: "Mobile responsive design", description: "Ensure all pages work on mobile devices", category: "design" },
		{ title: "Evaluate GraphQL", description: "Research benefits of migrating to GraphQL", category: "research" },
		{ title: "File upload feature", description: "Implement file upload with S3 storage", category: "feature" },
		{ title: "Fix CORS issues", description: "CORS errors when calling API from subdomain", category: "bug" },
		{ title: "Set up monitoring", description: "Configure Datadog for application monitoring", category: "chore" },
		{ title: "Integration tests", description: "Add integration tests for critical flows", category: "test" },
		{ title: "Update README", description: "Update README with latest setup instructions", category: "docs" },
	];

	const acceptanceCriteriaTemplates = [
		["Feature works as expected", "Unit tests pass", "Documentation updated"],
		["Bug is fixed and verified", "No regression in related features", "Test case added"],
		["Code follows style guide", "PR approved by reviewer", "Changes deployed to staging"],
		["Performance meets requirements", "Load testing completed", "Monitoring in place"],
		["Design approved by team", "Accessibility requirements met", "Responsive on all devices"],
	];

	let totalTasksCreated = 0;

	for (const project of createdProjects) {
		// Check if sprints already exist for this project
		const existingSprints = await prisma.sprint.findMany({
			where: { projectId: project.id },
		});

		if (existingSprints.length === 0) {
			for (let i = 0; i < sprintNames.length; i++) {
				const sprintData = sprintNames[i];
				const startDate = new Date();
				startDate.setDate(startDate.getDate() + (i - 2) * 14); // Spread sprints across time
				const deadline = new Date(startDate);
				deadline.setDate(deadline.getDate() + 14);

				const sprint = await prisma.sprint.create({
					data: {
						projectId: project.id,
						name: sprintData.name,
						goal: sprintData.goal,
						deadline: deadline,
						status: sprintData.status,
					},
				});

				// Create columns for each sprint
				const columns = [
					{ columnId: "backlog", name: "Backlog", order: 0 },
					{ columnId: "todo", name: "To Do", order: 1 },
					{ columnId: "in_progress", name: "In Progress", order: 2 },
					{ columnId: "review", name: "Review", order: 3 },
					{ columnId: "done", name: "Done", order: 4 },
				];

				for (const col of columns) {
					await prisma.sprintColumn.create({
						data: {
							sprintId: sprint.id,
							columnId: col.columnId,
							name: col.name,
							order: col.order,
						},
					});
				}

				// Create 5-10 tasks per sprint
				const numTasks = 5 + Math.floor(Math.random() * 6);
				const shuffledTasks = [...taskTemplates].sort(() => Math.random() - 0.5).slice(0, numTasks);

				for (let j = 0; j < shuffledTasks.length; j++) {
					const taskTemplate = shuffledTasks[j];
					const randomUser = createdTestUsers[Math.floor(Math.random() * createdTestUsers.length)];
					const assignee = Math.random() > 0.3 ? createdTestUsers[Math.floor(Math.random() * createdTestUsers.length)] : null;

					// Determine status based on sprint status
					let status: string;
					let passes = false;
					if (sprintData.status === "completed") {
						status = "done";
						passes = true;
					} else if (sprintData.status === "active") {
						status = taskStatuses[Math.floor(Math.random() * taskStatuses.length)];
						passes = status === "done";
					} else {
						status = Math.random() > 0.5 ? "backlog" : "todo";
					}

					const priority = priorities[Math.floor(Math.random() * priorities.length)];
					const criteria = acceptanceCriteriaTemplates[Math.floor(Math.random() * acceptanceCriteriaTemplates.length)];

					await prisma.task.create({
						data: {
							projectId: project.id,
							sprintId: sprint.id,
							category: taskTemplate.category,
							title: taskTemplate.title,
							description: taskTemplate.description,
							acceptanceCriteriaJson: JSON.stringify(criteria),
							status: status,
							priority: priority,
							passes: passes,
							createdById: randomUser.id,
							assigneeId: assignee?.id,
						},
					});
					totalTasksCreated++;
				}
			}
		}
	}
	console.log("Created sprints and", totalTasksCreated, "tasks across all projects");

	// ============================================================================
	// TEST AI RUNS
	// ============================================================================

	// Create some AI runs for the first project
	const phoenixProject = createdProjects[0];
	const phoenixSprints = await prisma.sprint.findMany({
		where: { projectId: phoenixProject.id },
		take: 2,
	});

	if (phoenixSprints.length > 0) {
		const phoenixTasks = await prisma.task.findMany({
			where: { sprintId: phoenixSprints[0].id },
			take: 5,
		});

		const runStatuses = ["completed", "completed", "completed", "failed", "running", "queued"];
		const aiModels = ["gpt-4", "gpt-4-turbo", "claude-3-opus", "claude-3-sonnet"];

		for (let i = 0; i < Math.min(phoenixTasks.length, 5); i++) {
			const task = phoenixTasks[i];
			const status = runStatuses[i % runStatuses.length];
			const model = aiModels[Math.floor(Math.random() * aiModels.length)];

			const existingRun = await prisma.aiRun.findFirst({
				where: { taskId: task.id },
			});

			if (!existingRun) {
				const run = await prisma.aiRun.create({
					data: {
						taskId: task.id,
						status: status,
						aiModel: model,
						promptTokens: Math.floor(Math.random() * 5000) + 1000,
						completionTokens: Math.floor(Math.random() * 10000) + 2000,
						totalTokens: 0,
						iterations: Math.floor(Math.random() * 10) + 1,
						startedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
						completedAt: status === "completed" || status === "failed" ? new Date() : null,
						errorMessage: status === "failed" ? "API rate limit exceeded" : null,
					},
				});

				// Update total tokens
				await prisma.aiRun.update({
					where: { id: run.id },
					data: { totalTokens: run.promptTokens + run.completionTokens },
				});

				// Add some logs for completed runs
				if (status === "completed" || status === "failed") {
					const logMessages = [
						{ level: "info", message: "Starting AI run..." },
						{ level: "info", message: "Analyzing task requirements" },
						{ level: "info", message: "Generating implementation plan" },
						{ level: "info", message: "Writing code..." },
						{ level: "info", message: "Running tests..." },
						status === "completed"
							? { level: "info", message: "All tests passed! Run completed successfully." }
							: { level: "error", message: "API rate limit exceeded. Please try again later." },
					];

					for (const log of logMessages) {
						await prisma.aiRunLog.create({
							data: {
								runId: run.id,
								level: log.level,
								message: log.message,
							},
						});
					}
				}
			}
		}
		console.log("Created AI runs with logs");
	}

	// ============================================================================
	// DEFAULT PROJECT & SPRINT
	// ============================================================================

	// Check if project already exists
	const existingProject = await prisma.project.findFirst({
		where: { organizationId: founderOrg.id, slug: "my-project" },
	});

	if (!existingProject) {
		// Create default project
		const project = await prisma.project.create({
			data: {
				organizationId: founderOrg.id,
				name: "My Project",
				slug: "my-project",
				description: "Your first project - a showcase of Ralph features",
			},
		});
		console.log("Created project:", project.name);

		// Create project settings
		await prisma.projectSettings.create({
			data: {
				projectId: project.id,
				projectName: "My Project",
				projectDescription:
					"Your first project - update this with your project details",
				techStackJson: JSON.stringify([]),
				howToTestJson: JSON.stringify({ commands: [], notes: "" }),
				howToRunJson: JSON.stringify({ commands: [], notes: "" }),
				aiPreferencesJson: JSON.stringify({ defaultModel: "gpt-4" }),
				repoConventionsJson: JSON.stringify({ folders: {}, naming: "" }),
			},
		});

		// Create "First Steps" sprint
		const sprintDeadline = new Date();
		sprintDeadline.setDate(sprintDeadline.getDate() + 14);

		const sprint = await prisma.sprint.create({
			data: {
				projectId: project.id,
				name: "First Steps",
				goal: "Get familiar with Ralph and set up your project",
				deadline: sprintDeadline,
				status: "active",
			},
		});
		console.log("Created sprint:", sprint.name);

		// Create sprint columns
		const columns = [
			{ columnId: "backlog", name: "Backlog", order: 0 },
			{ columnId: "todo", name: "To Do", order: 1 },
			{ columnId: "in_progress", name: "In Progress", order: 2 },
			{ columnId: "review", name: "Review", order: 3 },
			{ columnId: "done", name: "Done", order: 4 },
		];

		for (const col of columns) {
			await prisma.sprintColumn.create({
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
				description:
					"Configure your project settings with the correct information",
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
			await prisma.task.create({
				data: {
					projectId: project.id,
					sprintId: sprint.id,
					category: task.category,
					title: task.title,
					description: task.description,
					acceptanceCriteriaJson: JSON.stringify(task.acceptanceCriteria),
					status: "todo",
					priority: task.priority,
					createdById: joao.id,
				},
			});
		}
		console.log("Created 3 example tasks");
	} else {
		console.log("Project already exists, skipping...");
	}

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
