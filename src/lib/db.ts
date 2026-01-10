import { PrismaClient } from "../../generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

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

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.prisma = prisma;
}

export default prisma;
