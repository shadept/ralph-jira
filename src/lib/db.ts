import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma";

// Prevent multiple instances of Prisma Client in development
declare global {
	// eslint-disable-next-line no-var
	var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
	const dbPath = path.join(process.cwd(), "prisma", "ralph.db");
	const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
	return new PrismaClient({ adapter });
}

// biome-ignore lint/suspicious/noRedeclare: Intentional global singleton pattern for Prisma
export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.prisma = prisma;
}

export default prisma;
