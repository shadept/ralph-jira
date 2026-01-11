import { Prisma } from "../../generated/prisma";

type SoftDeleteField = "deletedAt" | "archivedAt" | string;

interface ModelConfig {
	field: SoftDeleteField;
	createValue?: (deleted: boolean) => Date | null;
}

interface SoftDeleteConfig {
	models: Record<string, ModelConfig>;
	defaultConfig?: ModelConfig;
}

const DEFAULT_CREATE_VALUE = (deleted: boolean) => (deleted ? new Date() : null);

const FILTER_OPERATIONS = ["findFirst", "findMany", "findUnique", "count"];

/**
 * Recursively filters soft-deleted records from nested includes.
 * Only filters arrays - does not modify single objects to preserve Prisma's proxy objects.
 */
function filterSoftDeleted<T>(
	data: T,
	models: Record<string, ModelConfig>,
): T {
	if (data === null || data === undefined) {
		return data;
	}

	// Only filter arrays - don't spread/modify single objects
	if (Array.isArray(data)) {
		return data
			.filter((item) => {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					for (const config of Object.values(models)) {
						if (config.field in item && (item as Record<string, unknown>)[config.field] !== null) {
							return false;
						}
					}
				}
				return true;
			})
			.map((item) => filterSoftDeleted(item, models)) as T;
	}

	return data;
}

/**
 * Creates a Prisma extension for soft delete filtering.
 *
 * @example
 * ```ts
 * const prisma = new PrismaClient().$extends(
 *   createSoftDeleteExtension({
 *     models: {
 *       User: { field: "deletedAt" },
 *       Task: { field: "archivedAt" },
 *     },
 *   })
 * );
 * ```
 */
export function createSoftDeleteExtension(config: SoftDeleteConfig) {
	const { models, defaultConfig } = config;

	return Prisma.defineExtension({
		name: "soft-delete",
		query: {
			$allModels: {
				async $allOperations({ model, operation, query, args }) {
					// Only apply to read operations
					if (!FILTER_OPERATIONS.includes(operation)) {
						return query(args);
					}

					// Get config for this model
					const modelConfig = models[model] || defaultConfig;
					if (!modelConfig) {
						return query(args);
					}

					// Add soft delete filter to where clause
					const argsWithWhere = args as { where?: Record<string, unknown> };
					argsWithWhere.where = argsWithWhere.where ?? {};

					// Only add filter if not already specified
					if (argsWithWhere.where[modelConfig.field] === undefined) {
						argsWithWhere.where[modelConfig.field] = null;
					}

					// Execute query
					const result = await query(args);

					// Filter soft-deleted records from nested includes
					return filterSoftDeleted(result, models);
				},
			},
		},
	});
}
