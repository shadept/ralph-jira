import { promises as fs } from "fs";
import path from "path";
import {
	Board,
	ProjectSettings,
	RunLog,
	BoardSchema,
	ProjectSettingsSchema,
	RunLogSchema,
} from "../schemas";
import { StorageAdapter } from "./interface";

export class LocalFilesystemAdapter implements StorageAdapter {
	private repoRoot: string;
	private plansDir: string;
	private runsDir: string;
	private progressFile: string;

	constructor(repoRoot: string = process.cwd()) {
		this.repoRoot = repoRoot;
		this.plansDir = path.join(repoRoot, "plans");
		this.runsDir = path.join(this.plansDir, "runs");
		this.progressFile = path.join(repoRoot, "progress.txt");
	}

	private async ensureDir(dir: string): Promise<void> {
		try {
			await fs.mkdir(dir, { recursive: true });
		} catch (error) {
			// Directory might already exist
		}
	}

	private async atomicWrite(filePath: string, content: string): Promise<void> {
		const tempPath = `${filePath}.tmp`;
		await fs.writeFile(tempPath, content, "utf-8");
		await fs.rename(tempPath, filePath);
	}

	private formatJson(obj: unknown): string {
		return JSON.stringify(obj, null, 2);
	}

	// Board operations
	async readBoard(boardId: string): Promise<Board> {
		// Map various IDs to the active board file
		const isActiveBoard =
			boardId === "active" || boardId === "prd" || boardId === "initial-sprint";
		const filePath = isActiveBoard
			? path.join(this.plansDir, "prd.json")
			: path.join(this.plansDir, `${boardId}.json`);

		const content = await fs.readFile(filePath, "utf-8");
		const data = JSON.parse(content);
		return BoardSchema.parse(data);
	}

	async writeBoard(board: Board): Promise<void> {
		await this.ensureDir(this.plansDir);

		const filePath =
			board.id === "active" ||
			board.id === "prd" ||
			board.id === "initial-sprint"
				? path.join(this.plansDir, "prd.json")
				: path.join(this.plansDir, `${board.id}.json`);

		const validated = BoardSchema.parse(board);
		const content = this.formatJson(validated);
		await this.atomicWrite(filePath, content);
	}

	async listBoards(): Promise<string[]> {
		await this.ensureDir(this.plansDir);

		const files = await fs.readdir(this.plansDir);
		const boardFiles = files.filter(
			(f) => f.endsWith(".json") && f !== "settings.json",
		);

		// Map prd.json to the board's actual ID from the file
		const boardIds: string[] = [];
		for (const file of boardFiles) {
			if (file === "prd.json") {
				// Read the file to get the actual board ID
				try {
					const content = await fs.readFile(
						path.join(this.plansDir, file),
						"utf-8",
					);
					const data = JSON.parse(content);
					boardIds.push(data.id || "prd");
				} catch {
					boardIds.push("prd");
				}
			} else {
				boardIds.push(file.replace(".json", ""));
			}
		}

		return boardIds;
	}

	async deleteBoard(boardId: string): Promise<void> {
		const filePath = path.join(this.plansDir, `${boardId}.json`);
		await fs.unlink(filePath);
	}

	// Settings operations
	async readSettings(): Promise<ProjectSettings> {
		const filePath = path.join(this.plansDir, "settings.json");
		const content = await fs.readFile(filePath, "utf-8");
		const data = JSON.parse(content);
		return ProjectSettingsSchema.parse(data);
	}

	async writeSettings(settings: ProjectSettings): Promise<void> {
		await this.ensureDir(this.plansDir);

		const filePath = path.join(this.plansDir, "settings.json");
		const validated = ProjectSettingsSchema.parse(settings);
		const content = this.formatJson(validated);
		await this.atomicWrite(filePath, content);
	}

	// Progress log operations
	async appendProgress(entry: string): Promise<void> {
		const timestamp = new Date().toISOString();
		const logEntry = `\n[${timestamp}]\n${entry}\n`;

		try {
			await fs.appendFile(this.progressFile, logEntry, "utf-8");
		} catch (error) {
			// If file doesn't exist, create it
			await fs.writeFile(
				this.progressFile,
				`# Project Progress Log${logEntry}`,
				"utf-8",
			);
		}
	}

	async readProgress(): Promise<string> {
		try {
			return await fs.readFile(this.progressFile, "utf-8");
		} catch (error) {
			return "# Project Progress Log\n";
		}
	}

	// Run log operations
	async writeRunLog(log: RunLog): Promise<void> {
		await this.ensureDir(this.runsDir);

		const filePath = path.join(this.runsDir, `${log.runId}.json`);
		const validated = RunLogSchema.parse(log);
		const content = this.formatJson(validated);
		await this.atomicWrite(filePath, content);
	}

	async readRunLog(runId: string): Promise<RunLog> {
		const filePath = path.join(this.runsDir, `${runId}.json`);
		const content = await fs.readFile(filePath, "utf-8");
		const data = JSON.parse(content);
		return RunLogSchema.parse(data);
	}

	async listRunLogs(): Promise<string[]> {
		await this.ensureDir(this.runsDir);

		try {
			const files = await fs.readdir(this.runsDir);
			return files
				.filter((f) => f.endsWith(".json"))
				.map((f) => f.replace(".json", ""));
		} catch (error) {
			return [];
		}
	}

	// File operations
	async readFile(filePath: string): Promise<string> {
		const fullPath = path.join(this.repoRoot, filePath);
		return await fs.readFile(fullPath, "utf-8");
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		const fullPath = path.join(this.repoRoot, filePath);
		const dir = path.dirname(fullPath);
		await this.ensureDir(dir);
		await fs.writeFile(fullPath, content, "utf-8");
	}

	async listFiles(pattern: string): Promise<string[]> {
		// Simple implementation - just list files in a directory
		// For production, consider using glob library
		const dir = pattern.includes("*") ? pattern.split("*")[0] : pattern;
		const fullPath = path.join(this.repoRoot, dir);

		try {
			const files = await fs.readdir(fullPath);
			return files;
		} catch (error) {
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
}
