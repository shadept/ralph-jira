import { PrismaClient } from "../../../generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { promises as fs } from "fs";
import path from "path";
import {
	Board,
	ProjectSettings,
	RunLog,
	BoardSchema,
	ProjectSettingsSchema,
	RunLogSchema,
	Column,
	Task,
	Sprint,
	SprintSchema,
} from "../schemas";
import { StorageAdapter } from "./interface";

/**
 * SQLite storage adapter using Prisma ORM with driver adapter.
 * Stores all data in a SQLite database file.
 *
 * Note: This adapter is designed for the new multi-tenant schema.
 * The legacy Board model in schemas.ts is for file-based storage backwards compatibility only.
 * The database uses Sprint/Task models directly.
 */
export class SQLiteStorageAdapter implements StorageAdapter {
	private prisma: PrismaClient;
	private repoRoot: string;
	private initialized: boolean = false;

	constructor(repoRoot: string = process.cwd(), databaseUrl?: string) {
		this.repoRoot = repoRoot;

		// Default database URL if not provided
		const dbUrl =
			databaseUrl || `file:${path.join(repoRoot, "prisma", "ralph.db")}`;

		const adapter = new PrismaBetterSqlite3({ url: dbUrl });
		this.prisma = new PrismaClient({ adapter });
	}

	/**
	 * Ensures the database is connected and ready.
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;

		await this.prisma.$connect();
		this.initialized = true;
	}

	/**
	 * Disconnects from the database. Call this when done with the adapter.
	 */
	async disconnect(): Promise<void> {
		await this.prisma.$disconnect();
		this.initialized = false;
	}

	// ============================================================================
	// Board operations (maps to Sprint in the database)
	// ============================================================================

	async readBoard(boardId: string): Promise<Board> {
		await this.ensureInitialized();

		// Map various IDs to actual sprint lookup
		const isActiveBoard =
			boardId === "active" || boardId === "prd" || boardId === "initial-sprint";

		let sprint;
		if (isActiveBoard) {
			// Find the first active or any sprint if no active
			sprint = await this.prisma.sprint.findFirst({
				where: { status: "active" },
				include: { columns: true, tasks: true },
			});

			if (!sprint) {
				sprint = await this.prisma.sprint.findFirst({
					include: { columns: true, tasks: true },
				});
			}
		} else {
			sprint = await this.prisma.sprint.findUnique({
				where: { id: boardId },
				include: { columns: true, tasks: true },
			});
		}

		if (!sprint) {
			throw new Error(`Board/Sprint not found: ${boardId}`);
		}

		return this.dbSprintToBoard(sprint);
	}

	async writeBoard(board: Board): Promise<void> {
		await this.ensureInitialized();

		const validated = BoardSchema.parse(board);

		// Get or create a default project for legacy boards
		const defaultProject = await this.getOrCreateDefaultProject();

		// Map board status to sprint status
		const sprintStatus =
			validated.status === "planned" ? "planning" : validated.status;

		// Upsert the sprint
		await this.prisma.sprint.upsert({
			where: { id: validated.id },
			create: {
				id: validated.id,
				projectId: defaultProject.id,
				name: validated.name,
				goal: validated.goal,
				deadline: new Date(validated.deadline),
				status: sprintStatus,
				metricsJson: validated.metrics
					? JSON.stringify(validated.metrics)
					: null,
				createdAt: new Date(validated.createdAt),
				updatedAt: new Date(validated.updatedAt),
			},
			update: {
				name: validated.name,
				goal: validated.goal,
				deadline: new Date(validated.deadline),
				status: sprintStatus,
				metricsJson: validated.metrics
					? JSON.stringify(validated.metrics)
					: null,
				updatedAt: new Date(validated.updatedAt),
			},
		});

		// Delete existing columns for this sprint
		await this.prisma.sprintColumn.deleteMany({
			where: { sprintId: validated.id },
		});

		// Create columns
		if (validated.columns.length > 0) {
			await this.prisma.sprintColumn.createMany({
				data: validated.columns.map((col) => ({
					sprintId: validated.id,
					columnId: col.id,
					name: col.name,
					order: col.order,
				})),
			});
		}

		// Handle tasks - need to upsert each task with projectId
		if (validated.tasks.length > 0) {
			for (const task of validated.tasks) {
				await this.prisma.task.upsert({
					where: { id: task.id },
					create: {
						id: task.id,
						projectId: defaultProject.id,
						sprintId: validated.id,
						category: task.category,
						title: task.title || null,
						description: task.description,
						acceptanceCriteriaJson: JSON.stringify(task.acceptanceCriteria),
						passes: task.passes,
						status: task.status,
						priority: task.priority,
						estimate: task.estimate || null,
						createdAt: new Date(task.createdAt),
						updatedAt: new Date(task.updatedAt),
						tagsJson: JSON.stringify(task.tags),
						filesTouchedJson: JSON.stringify(task.filesTouched),
						lastRun: task.lastRun ? new Date(task.lastRun) : null,
						failureNotes: task.failureNotes || null,
					},
					update: {
						sprintId: validated.id,
						category: task.category,
						title: task.title || null,
						description: task.description,
						acceptanceCriteriaJson: JSON.stringify(task.acceptanceCriteria),
						passes: task.passes,
						status: task.status,
						priority: task.priority,
						estimate: task.estimate || null,
						updatedAt: new Date(task.updatedAt),
						tagsJson: JSON.stringify(task.tags),
						filesTouchedJson: JSON.stringify(task.filesTouched),
						lastRun: task.lastRun ? new Date(task.lastRun) : null,
						failureNotes: task.failureNotes || null,
					},
				});
			}
		}
	}

	async listBoards(): Promise<string[]> {
		await this.ensureInitialized();

		const sprints = await this.prisma.sprint.findMany({
			select: { id: true },
		});

		return sprints.map((s) => s.id);
	}

	async deleteBoard(boardId: string): Promise<void> {
		await this.ensureInitialized();

		// First, unassign tasks from this sprint (don't delete them)
		await this.prisma.task.updateMany({
			where: { sprintId: boardId },
			data: { sprintId: null },
		});

		await this.prisma.sprint.delete({
			where: { id: boardId },
		});
	}

	// ============================================================================
	// Settings operations
	// ============================================================================

	async readSettings(): Promise<ProjectSettings> {
		await this.ensureInitialized();

		// Get the default project's settings
		const defaultProject = await this.getOrCreateDefaultProject();

		const settings = await this.prisma.projectSettings.findUnique({
			where: { projectId: defaultProject.id },
		});

		if (!settings) {
			throw new Error("Settings not found");
		}

		const data: ProjectSettings = {
			projectName: settings.projectName,
			projectDescription: settings.projectDescription,
			techStack: JSON.parse(settings.techStackJson),
			howToTest: JSON.parse(settings.howToTestJson),
			howToRun: JSON.parse(settings.howToRunJson),
			aiPreferences: JSON.parse(settings.aiPreferencesJson),
			repoConventions: JSON.parse(settings.repoConventionsJson),
			automation: settings.automationJson
				? JSON.parse(settings.automationJson)
				: undefined,
		};

		return ProjectSettingsSchema.parse(data);
	}

	async writeSettings(settings: ProjectSettings): Promise<void> {
		await this.ensureInitialized();

		const validated = ProjectSettingsSchema.parse(settings);
		const defaultProject = await this.getOrCreateDefaultProject();

		await this.prisma.projectSettings.upsert({
			where: { projectId: defaultProject.id },
			create: {
				projectId: defaultProject.id,
				projectName: validated.projectName,
				projectDescription: validated.projectDescription,
				techStackJson: JSON.stringify(validated.techStack),
				howToTestJson: JSON.stringify(validated.howToTest),
				howToRunJson: JSON.stringify(validated.howToRun),
				aiPreferencesJson: JSON.stringify(validated.aiPreferences),
				repoConventionsJson: JSON.stringify(validated.repoConventions),
				automationJson: validated.automation
					? JSON.stringify(validated.automation)
					: null,
			},
			update: {
				projectName: validated.projectName,
				projectDescription: validated.projectDescription,
				techStackJson: JSON.stringify(validated.techStack),
				howToTestJson: JSON.stringify(validated.howToTest),
				howToRunJson: JSON.stringify(validated.howToRun),
				aiPreferencesJson: JSON.stringify(validated.aiPreferences),
				repoConventionsJson: JSON.stringify(validated.repoConventions),
				automationJson: validated.automation
					? JSON.stringify(validated.automation)
					: null,
			},
		});
	}

	// ============================================================================
	// Progress log operations (uses RunLog now)
	// ============================================================================

	async appendProgress(entry: string): Promise<void> {
		// Progress is now tracked per-run via RunLog
		// This method is deprecated but kept for compatibility
		console.warn(
			"appendProgress is deprecated. Use run-specific logs instead.",
		);
	}

	async readProgress(): Promise<string> {
		// Progress is now tracked per-run via RunLog
		// This method is deprecated but kept for compatibility
		return "# Project Progress Log\n(Progress tracking has moved to per-run logs)\n";
	}

	// ============================================================================
	// Run log operations
	// ============================================================================

	async writeRunLog(log: RunLog): Promise<void> {
		// The legacy RunLog format is for file-based storage
		// Database uses the Run model with RunLog entries
		console.warn(
			"writeRunLog is deprecated. Use Run model with appendRunLog instead.",
		);
	}

	async readRunLog(runId: string): Promise<RunLog> {
		throw new Error(
			`Legacy RunLog format not supported. Use Run model with runId: ${runId}`,
		);
	}

	async listRunLogs(): Promise<string[]> {
		// Return run IDs from the new Run model
		await this.ensureInitialized();
		const runs = await this.prisma.run.findMany({
			select: { runId: true },
		});
		return runs.map((r) => r.runId);
	}

	// ============================================================================
	// File operations - these still use filesystem since they deal with actual code files
	// ============================================================================

	async readFile(filePath: string): Promise<string> {
		const fullPath = path.join(this.repoRoot, filePath);
		return await fs.readFile(fullPath, "utf-8");
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		const fullPath = path.join(this.repoRoot, filePath);
		const dir = path.dirname(fullPath);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(fullPath, content, "utf-8");
	}

	async listFiles(pattern: string): Promise<string[]> {
		const dir = pattern.includes("*") ? pattern.split("*")[0] : pattern;
		const fullPath = path.join(this.repoRoot, dir);

		try {
			const files = await fs.readdir(fullPath);
			return files;
		} catch {
			return [];
		}
	}

	async readProjectReadme(): Promise<string | null> {
		const readmeNames = ["README.md", "readme.md", "Readme.md", "README.MD"];

		for (const name of readmeNames) {
			try {
				const content = await fs.readFile(
					path.join(this.repoRoot, name),
					"utf-8",
				);
				return content;
			} catch {
				// Try next name
			}
		}

		return null;
	}

	// ============================================================================
	// Helper methods
	// ============================================================================

	/**
	 * Gets or creates a default organization and project for legacy boards.
	 */
	private async getOrCreateDefaultProject() {
		// First check if we have a default organization
		let org = await this.prisma.organization.findFirst({
			where: { slug: "default" },
		});

		if (!org) {
			org = await this.prisma.organization.create({
				data: {
					name: "Default Organization",
					slug: "default",
				},
			});
		}

		// Check for default project
		let project = await this.prisma.project.findFirst({
			where: { organizationId: org.id, slug: "default" },
		});

		if (!project) {
			project = await this.prisma.project.create({
				data: {
					organizationId: org.id,
					name: "Default Project",
					slug: "default",
					description: "Legacy project for backwards compatibility",
				},
			});
		}

		return project;
	}

	private dbSprintToBoard(sprint: {
		id: string;
		name: string;
		goal: string | null;
		deadline: Date;
		status: string;
		createdAt: Date;
		updatedAt: Date;
		metricsJson: string | null;
		columns: Array<{ columnId: string; name: string; order: number }>;
		tasks: Array<{
			id: string;
			category: string;
			title: string | null;
			description: string;
			acceptanceCriteriaJson: string;
			passes: boolean;
			status: string;
			priority: string;
			estimate: number | null;
			createdAt: Date;
			updatedAt: Date;
			tagsJson: string;
			filesTouchedJson: string;
			lastRun: Date | null;
			failureNotes: string | null;
			projectId: string;
			sprintId: string | null;
		}>;
	}): Board {
		const columns: Column[] = sprint.columns.map((col) => ({
			id: col.columnId,
			name: col.name,
			order: col.order,
		}));

		const mappedTasks = sprint.tasks.map((task) => ({
			id: task.id,
			projectId: task.projectId,
			sprintId: task.sprintId,
			category: task.category,
			title: task.title,
			description: task.description,
			acceptanceCriteria: JSON.parse(task.acceptanceCriteriaJson),
			passes: task.passes,
			status: task.status,
			priority: task.priority as "low" | "medium" | "high" | "urgent",
			estimate: task.estimate ?? undefined,
			createdAt: task.createdAt.toISOString(),
			updatedAt: task.updatedAt.toISOString(),
			tags: JSON.parse(task.tagsJson),
			filesTouched: JSON.parse(task.filesTouchedJson),
			lastRun: task.lastRun?.toISOString(),
			failureNotes: task.failureNotes ?? undefined,
		}));

		const metrics = sprint.metricsJson
			? JSON.parse(sprint.metricsJson)
			: undefined;

		// Map sprint status to board status
		const boardStatus =
			sprint.status === "planning" ? "planned" : sprint.status;

		return BoardSchema.parse({
			id: sprint.id,
			name: sprint.name,
			goal: sprint.goal || "",
			deadline: sprint.deadline.toISOString(),
			status: boardStatus,
			columns,
			tasks: mappedTasks,
			createdAt: sprint.createdAt.toISOString(),
			updatedAt: sprint.updatedAt.toISOString(),
			metrics,
		});
	}
}
