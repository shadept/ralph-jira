import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma";

// Prevent multiple instances of Prisma Client in development
declare global {
	// eslint-disable-next-line no-var
	var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

// Models with archivedAt field
const ARCHIVED_MODELS = ["Task", "Sprint", "Project"];

// Models with deletedAt field
const DELETED_MODELS = [
	"User",
	"Organization",
	"UserApiKey",
	"OrganizationApiKey",
	"Project",
];

// Operations that should filter soft-deleted records
const FILTER_OPERATIONS = ["findFirst", "findMany", "findUnique", "count"];

function createPrismaClient() {
	const dbPath = path.join(process.cwd(), "prisma", "ralph.db");
	const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
	const baseClient = new PrismaClient({ adapter });

	// Extend the client with soft-delete filtering for all models
	return baseClient.$extends({
		query: {
			$allModels: {
				$allOperations({ model, operation, query, args }) {
					// Only apply to read operations
					if (!FILTER_OPERATIONS.includes(operation)) {
						return query(args);
					}

					// Initialize where clause if needed
					const argsWithWhere = args as { where?: Record<string, unknown> };
					argsWithWhere.where = argsWithWhere.where ?? {};

					// Add archivedAt filter for models that have it
					if (
						ARCHIVED_MODELS.includes(model) &&
						argsWithWhere.where.archivedAt === undefined
					) {
						argsWithWhere.where.archivedAt = null;
					}

					// Add deletedAt filter for models that have it
					if (
						DELETED_MODELS.includes(model) &&
						argsWithWhere.where.deletedAt === undefined
					) {
						argsWithWhere.where.deletedAt = null;
					}

					return query(args);
				},
			},
		},
	});
}

// biome-ignore lint/suspicious/noRedeclare: Intentional global singleton pattern for Prisma
export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.prisma = prisma;
}

export type ExtendedPrismaClient = typeof prisma;
export default prisma;
