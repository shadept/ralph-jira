import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma";

// Use an in-memory database for testing
let testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
	if (!testPrisma) {
		// Create a test database file
		const testDbPath = path.join(process.cwd(), "prisma", "test.db");

		// Remove existing test database
		if (fs.existsSync(testDbPath)) {
			fs.unlinkSync(testDbPath);
		}

		// Create fresh test database with schema
		try {
			execSync(`npx prisma db push --skip-generate`, {
				env: {
					...process.env,
					DATABASE_URL: `file:${testDbPath}`,
				},
				stdio: "inherit",
			});
		} catch {
			// Schema might already exist
		}

		const adapter = new PrismaBetterSqlite3({ url: `file:${testDbPath}` });
		testPrisma = new PrismaClient({ adapter });
	}
	return testPrisma;
}

export async function cleanupTestDb() {
	if (testPrisma) {
		await testPrisma.$disconnect();
		testPrisma = null;
	}

	const testDbPath = path.join(process.cwd(), "prisma", "test.db");
	if (fs.existsSync(testDbPath)) {
		fs.unlinkSync(testDbPath);
	}
}
