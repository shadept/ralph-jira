#!/usr/bin/env npx tsx
/**
 * Ingests a missed run result from a worktree prd.json file
 *
 * Usage: npx tsx scripts/ingest-run-result.ts <path-to-prd.json>
 * Example: npx tsx scripts/ingest-run-result.ts .worktrees/run-xxx/plans/prd.json
 */

import { prisma } from "../src/lib/db";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Sanitizes text by replacing smart/curly quotes with straight ASCII quotes.
 */
function sanitizeQuotes(text: string): string {
	if (typeof text !== "string") return text;
	return text
		.replace(/[\u201C\u201D]/g, '"')
		.replace(/[\u2018\u2019]/g, "'");
}

/**
 * Recursively sanitizes all string values in an object or array.
 */
function deepSanitize<T>(value: T): T {
	if (typeof value === "string") {
		return sanitizeQuotes(value) as T;
	}
	if (Array.isArray(value)) {
		return value.map(deepSanitize) as T;
	}
	if (value && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(value)) {
			result[key] = deepSanitize((value as Record<string, unknown>)[key]);
		}
		return result as T;
	}
	return value;
}

interface Task {
	id: string;
	title: string;
	status: string;
	passes?: boolean;
	failureNotes?: string | null;
	filesTouched?: string[];
	lastRun?: string | null;
}

interface PrdContent {
	id: string;
	name: string;
	tasks: Task[];
}

async function main() {
	const prdPath = process.argv[2];

	if (!prdPath) {
		console.error(
			"Usage: npx tsx scripts/ingest-run-result.ts <path-to-prd.json>",
		);
		console.error(
			"Example: npx tsx scripts/ingest-run-result.ts .worktrees/run-xxx/plans/prd.json",
		);
		process.exit(1);
	}

	const fullPath = path.resolve(prdPath);
	console.log(`Reading PRD from: ${fullPath}`);

	let prdContent: PrdContent;
	try {
		const raw = await fs.readFile(fullPath, "utf-8");
		prdContent = JSON.parse(raw);
	} catch (err) {
		console.error(`Failed to read/parse PRD file: ${(err as Error).message}`);
		process.exit(1);
	}

	const sprintId = prdContent.id;
	const tasks = prdContent.tasks || [];

	console.log(`Sprint ID: ${sprintId}`);
	console.log(`Tasks to sync: ${tasks.length}`);

	// Verify sprint exists
	const sprint = await prisma.sprint.findUnique({
		where: { id: sprintId },
	});

	if (!sprint) {
		console.error(`Sprint not found: ${sprintId}`);
		process.exit(1);
	}

	console.log(`Found sprint: ${sprint.name}`);
	console.log("");

	let updated = 0;
	let skipped = 0;
	let errors = 0;

	for (const task of tasks) {
		const sanitizedTask = deepSanitize(task);

		try {
			const existing = await prisma.task.findUnique({
				where: { id: task.id },
			});

			if (!existing) {
				console.log(`  [SKIP] Task ${task.id} not found in database`);
				skipped++;
				continue;
			}

			await prisma.task.update({
				where: { id: task.id },
				data: {
					status: sanitizedTask.status,
					passes: sanitizedTask.passes ?? false,
					failureNotes: sanitizedTask.failureNotes || null,
					filesTouchedJson: JSON.stringify(sanitizedTask.filesTouched || []),
					lastRun: sanitizedTask.lastRun
						? new Date(sanitizedTask.lastRun)
						: null,
					updatedAt: new Date(),
				},
			});

			console.log(`  [OK] ${task.title.slice(0, 60)}...`);
			console.log(`       status: ${existing.status} -> ${sanitizedTask.status}`);
			if (sanitizedTask.filesTouched?.length) {
				console.log(`       files: ${sanitizedTask.filesTouched.join(", ")}`);
			}
			updated++;
		} catch (err) {
			console.error(`  [ERROR] ${task.id}: ${(err as Error).message}`);
			errors++;
		}
	}

	console.log("");
	console.log("Summary:");
	console.log(`  Updated: ${updated}`);
	console.log(`  Skipped: ${skipped}`);
	console.log(`  Errors: ${errors}`);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
