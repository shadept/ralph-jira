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

const FILTER_OPERATIONS = ["findFirst", "findMany", "findUnique", "count"];

/**
 * Maps common relation names to model names.
 * Handles: tasks -> Task, sprints -> Sprint, etc.
 */
function relationToModelName(relationName: string): string {
	// Remove trailing 's' for plural relations and capitalize
	const singular = relationName.endsWith("s")
		? relationName.slice(0, -1)
		: relationName;
	return singular.charAt(0).toUpperCase() + singular.slice(1);
}

/**
 * Recursively adds soft-delete where clauses to nested includes.
 * Transforms `include: { tasks: true }` into `include: { tasks: { where: { archivedAt: null } } }`
 */
function addSoftDeleteToIncludes(
	args: Record<string, unknown>,
	models: Record<string, ModelConfig>,
): void {
	const include = args.include as Record<string, unknown> | undefined;
	if (!include) return;

	for (const [relationName, relationValue] of Object.entries(include)) {
		// Try to find matching model config
		const modelName = relationToModelName(relationName);
		const modelConfig = models[modelName];

		if (!modelConfig) continue;

		if (relationValue === true) {
			// Transform `tasks: true` to `tasks: { where: { archivedAt: null } }`
			include[relationName] = {
				where: { [modelConfig.field]: null },
			};
		} else if (
			relationValue &&
			typeof relationValue === "object" &&
			!Array.isArray(relationValue)
		) {
			// Already an object config, add where clause if not present
			const relationConfig = relationValue as Record<string, unknown>;
			if (!relationConfig.where) {
				relationConfig.where = { [modelConfig.field]: null };
			} else {
				const where = relationConfig.where as Record<string, unknown>;
				if (where[modelConfig.field] === undefined) {
					where[modelConfig.field] = null;
				}
			}
			// Recurse into nested includes
			addSoftDeleteToIncludes(relationConfig, models);
		}
	}
}

/**
 * Creates a Prisma extension for soft delete filtering.
 *
 * Automatically:
 * 1. Adds soft-delete filter to main query WHERE clause
 * 2. Adds soft-delete filter to nested includes
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

					// Add soft delete filter to main where clause
					const argsWithWhere = args as {
						where?: Record<string, unknown>;
						include?: Record<string, unknown>;
					};
					argsWithWhere.where = argsWithWhere.where ?? {};

					// Only add filter if not already specified
					if (argsWithWhere.where[modelConfig.field] === undefined) {
						argsWithWhere.where[modelConfig.field] = null;
					}

					// Add soft delete filters to nested includes
					addSoftDeleteToIncludes(argsWithWhere, models);

					// Execute query
					return query(args);
				},
			},
		},
	});
}
