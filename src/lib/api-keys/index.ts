import crypto from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Generate an API key with the given prefix.
 * Key format: {prefix}_{64 hex chars}
 * - ck_ for user/client keys
 * - rk_ for runner tokens
 */
export function generateApiKey(type: "user" | "runner"): {
	plaintext: string;
	hash: string;
} {
	const prefix = type === "user" ? "ck_" : "rk_";
	const random = crypto.randomBytes(32).toString("hex");
	const plaintext = `${prefix}${random}`;
	const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
	return { plaintext, hash };
}

/**
 * Hash an API key for lookup/validation.
 */
export function hashApiKey(key: string): string {
	return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Validated key information returned from validateApiKey.
 */
export interface ValidatedKey {
	userId: string;
	projectId: string | null;
	sprintId: string | null;
	runId: string | null;
}

/**
 * Validate an API key from the Authorization header.
 * Returns the key's scope information or null if invalid.
 */
export async function validateApiKey(
	authHeader: string | null,
): Promise<ValidatedKey | null> {
	if (!authHeader?.startsWith("Bearer ")) return null;

	const token = authHeader.slice(7);
	if (!token.startsWith("ck_") && !token.startsWith("rk_")) return null;

	const hash = hashApiKey(token);
	const key = await prisma.authToken.findUnique({
		where: { keyHash: hash },
	});

	if (!key || !key.isActive || key.revokedAt) return null;
	if (key.expiresAt && key.expiresAt < new Date()) return null;

	// Update usage tracking (fire-and-forget)
	prisma.authToken
		.update({
			where: { id: key.id },
			data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
		})
		.catch(() => {});

	return {
		userId: key.userId,
		projectId: key.projectId,
		sprintId: key.sprintId,
		runId: key.runId,
	};
}

/**
 * Create a runner token scoped to a specific run.
 * Returns the plaintext token (only shown once).
 */
export async function createRunnerToken(
	userId: string,
	projectId: string,
	sprintId: string,
	runId: string,
): Promise<string> {
	const { plaintext, hash } = generateApiKey("runner");
	const expiresAt = new Date();
	expiresAt.setHours(expiresAt.getHours() + 24);

	await prisma.authToken.create({
		data: {
			userId,
			name: `Runner: ${runId}`,
			keyHash: hash,
			projectId,
			sprintId,
			runId,
			expiresAt,
		},
	});

	return plaintext;
}

/**
 * Cleanup expired runner tokens and tokens for completed runs.
 * Can be called periodically via cron or on-demand.
 */
export async function cleanupRunnerTokens(): Promise<number> {
	const result = await prisma.authToken.deleteMany({
		where: {
			runId: { not: null }, // Only runner tokens
			OR: [
				{ expiresAt: { lt: new Date() } },
				{
					run: {
						status: { in: ["completed", "failed", "canceled"] },
					},
				},
			],
		},
	});
	return result.count;
}
