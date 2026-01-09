#!/usr/bin/env tsx
/**
 * Migration script to convert data from LocalFilesystemAdapter to SQLiteStorageAdapter.
 *
 * Usage:
 *   npm run migrate-to-sqlite
 *
 * Or directly:
 *   tsx src/lib/storage/migrate-to-sqlite.ts [projectPath]
 *
 * This script will:
 * 1. Read all boards, settings, run logs from the filesystem
 * 2. Create/update the SQLite database with the same data
 * 3. Preserve the original files (no deletion)
 */

import { LocalFilesystemAdapter } from "./local-filesystem";
import { SQLiteStorageAdapter } from "./sqlite-adapter";
import path from "path";

interface MigrationResult {
	boards: { migrated: number; errors: string[] };
	settings: { migrated: boolean; error?: string };
	runLogs: { migrated: number; errors: string[] };
	progress: { migrated: boolean; error?: string };
}

async function migrateToSqlite(projectPath: string): Promise<MigrationResult> {
	console.log(`Starting migration for project: ${projectPath}`);

	const fsAdapter = new LocalFilesystemAdapter(projectPath);
	const sqliteAdapter = new SQLiteStorageAdapter(projectPath);

	const result: MigrationResult = {
		boards: { migrated: 0, errors: [] },
		settings: { migrated: false },
		runLogs: { migrated: 0, errors: [] },
		progress: { migrated: false },
	};

	try {
		// Migrate boards
		console.log("\n--- Migrating Boards ---");
		try {
			const boardIds = await fsAdapter.listBoards();
			console.log(`Found ${boardIds.length} board(s) to migrate`);

			for (const boardId of boardIds) {
				try {
					const board = await fsAdapter.readBoard(boardId);
					await sqliteAdapter.writeBoard(board);
					console.log(`  Migrated board: ${board.id} (${board.name})`);
					result.boards.migrated++;
				} catch (error) {
					const msg = `Failed to migrate board ${boardId}: ${error instanceof Error ? error.message : String(error)}`;
					console.error(`  ${msg}`);
					result.boards.errors.push(msg);
				}
			}
		} catch (error) {
			console.error(
				`Failed to list boards: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// Migrate settings
		console.log("\n--- Migrating Settings ---");
		try {
			const settings = await fsAdapter.readSettings();
			await sqliteAdapter.writeSettings(settings);
			console.log(`  Migrated settings for: ${settings.projectName}`);
			result.settings.migrated = true;
		} catch (error) {
			const msg = `Failed to migrate settings: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`  ${msg}`);
			result.settings.error = msg;
		}

		// Migrate run logs
		console.log("\n--- Migrating Run Logs ---");
		try {
			const runIds = await fsAdapter.listRunLogs();
			console.log(`Found ${runIds.length} run log(s) to migrate`);

			for (const runId of runIds) {
				try {
					const runLog = await fsAdapter.readRunLog(runId);
					await sqliteAdapter.writeRunLog(runLog);
					console.log(`  Migrated run log: ${runId}`);
					result.runLogs.migrated++;
				} catch (error) {
					const msg = `Failed to migrate run log ${runId}: ${error instanceof Error ? error.message : String(error)}`;
					console.error(`  ${msg}`);
					result.runLogs.errors.push(msg);
				}
			}
		} catch (error) {
			console.error(
				`Failed to list run logs: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// Migrate progress log
		console.log("\n--- Migrating Progress Log ---");
		try {
			const progress = await fsAdapter.readProgress();
			if (progress && progress !== "# Project Progress Log\n") {
				// Parse existing progress entries and migrate them
				// The format is: [timestamp]\nentry\n
				const entries = progress.split(/\n\[/).slice(1); // Skip header
				for (const entry of entries) {
					const match = entry.match(/^([^\]]+)\]\n([\s\S]*?)(?=\n\[|$)/);
					if (match) {
						const content = match[2].trim();
						if (content) {
							await sqliteAdapter.appendProgress(content);
						}
					}
				}
				console.log(`  Migrated progress log entries`);
				result.progress.migrated = true;
			} else {
				console.log(`  No progress entries to migrate`);
				result.progress.migrated = true;
			}
		} catch (error) {
			const msg = `Failed to migrate progress: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`  ${msg}`);
			result.progress.error = msg;
		}

		return result;
	} finally {
		await sqliteAdapter.disconnect();
	}
}

function printSummary(result: MigrationResult): void {
	console.log("\n========== Migration Summary ==========");
	console.log(
		`Boards: ${result.boards.migrated} migrated, ${result.boards.errors.length} errors`,
	);
	console.log(`Settings: ${result.settings.migrated ? "migrated" : "failed"}`);
	console.log(
		`Run Logs: ${result.runLogs.migrated} migrated, ${result.runLogs.errors.length} errors`,
	);
	console.log(`Progress: ${result.progress.migrated ? "migrated" : "failed"}`);

	const totalErrors =
		result.boards.errors.length +
		(result.settings.error ? 1 : 0) +
		result.runLogs.errors.length +
		(result.progress.error ? 1 : 0);

	if (totalErrors > 0) {
		console.log(`\nTotal errors: ${totalErrors}`);
		console.log("\nTo use SQLite storage, set environment variable:");
		console.log("  RALPH_STORAGE_TYPE=sqlite");
	} else {
		console.log("\nMigration completed successfully!");
		console.log("\nTo use SQLite storage, set environment variable:");
		console.log("  RALPH_STORAGE_TYPE=sqlite");
	}
}

// Main execution
async function main(): Promise<void> {
	const projectPath = process.argv[2] || process.cwd();
	const resolvedPath = path.resolve(projectPath);

	console.log("=".repeat(50));
	console.log("Ralph-Jira: Filesystem to SQLite Migration");
	console.log("=".repeat(50));

	try {
		const result = await migrateToSqlite(resolvedPath);
		printSummary(result);

		const hasErrors =
			result.boards.errors.length > 0 ||
			result.settings.error ||
			result.runLogs.errors.length > 0 ||
			result.progress.error;

		process.exit(hasErrors ? 1 : 0);
	} catch (error) {
		console.error("\nMigration failed with error:", error);
		process.exit(1);
	}
}

main();
