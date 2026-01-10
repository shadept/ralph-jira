import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma";

const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/ralph.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
	const email = process.argv[2] || "jllf.17@gmail.com";

	// Find the user
	const user = await prisma.user.findUnique({
		where: { email },
		include: { memberships: true },
	});

	if (!user) {
		console.log("User not found:", email);
		return;
	}

	const orgId = user.memberships[0]?.organizationId;
	if (!orgId) {
		console.log("No organization found for user");
		return;
	}

	console.log("Creating project for org:", orgId);

	// Check if project already exists
	const existingProject = await prisma.project.findFirst({
		where: { organizationId: orgId },
	});

	if (existingProject) {
		console.log("Project already exists:", existingProject.name);
		return;
	}

	// Create default project
	const project = await prisma.project.create({
		data: {
			organizationId: orgId,
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
	console.log("Created project settings");

	// Create sprint
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

	// Create columns
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
	console.log("Created columns");

	// Create tasks
	const tasks = [
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

	for (const task of tasks) {
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
				createdById: user.id,
			},
		});
	}
	console.log("Created 3 example tasks");

	console.log("\nDone! Default project created successfully.");
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
