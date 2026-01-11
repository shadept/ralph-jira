import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma";
import { createSoftDeleteExtension } from "./prisma-soft-delete";

// Prevent multiple instances of Prisma Client in development
declare global {
	// eslint-disable-next-line no-var
	var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

function createPrismaClient() {
	const dbPath = path.join(process.cwd(), "prisma", "ralph.db");
	const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
	const baseClient = new PrismaClient({ adapter });

	return baseClient.$extends(
		createSoftDeleteExtension({
			models: {
				// Models using archivedAt
				Task: {
					field: "archivedAt",
					createValue: (deleted) => (deleted ? new Date() : null),
				},
				Sprint: {
					field: "archivedAt",
					createValue: (deleted) => (deleted ? new Date() : null),
				},
				Project: {
					field: "archivedAt",
					createValue: (deleted) => (deleted ? new Date() : null),
				},
				// Models using deletedAt
				User: {
					field: "deletedAt",
					createValue: (deleted) => (deleted ? new Date() : null),
				},
				Organization: {
					field: "deletedAt",
					createValue: (deleted) => (deleted ? new Date() : null),
				},
				UserApiKey: {
					field: "deletedAt",
					createValue: (deleted) => (deleted ? new Date() : null),
				},
				OrganizationApiKey: {
					field: "deletedAt",
					createValue: (deleted) => (deleted ? new Date() : null),
				},
			},
		}),
	) as typeof baseClient;
}

// biome-ignore lint/suspicious/noRedeclare: Intentional global singleton pattern for Prisma
export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.prisma = prisma;
}

export type ExtendedPrismaClient = typeof prisma;
export default prisma;
