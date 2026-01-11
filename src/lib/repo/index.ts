/**
 * Repository Adapter Factory
 *
 * Detects adapter type from repo URL and creates appropriate adapter.
 */

import { GitHubRepoAdapter } from "./adapters/github";
import { LocalRepoAdapter } from "./adapters/local";
import type { AdapterType, RepoAdapter, RepoConfig } from "./types";

export * from "./limits";
export * from "./types";

/**
 * Detect adapter type from a repo URL
 *
 * @example
 * detectAdapterType("/Users/me/projects/app") // "local"
 * detectAdapterType("file:///Users/me/projects/app") // "local"
 * detectAdapterType("https://github.com/acme/app") // "github"
 * detectAdapterType("git@github.com:acme/app.git") // "github"
 */
export function detectAdapterType(repoUrl: string): AdapterType {
	if (!repoUrl) {
		throw new Error("Repo URL is required");
	}

	// Local filesystem paths
	if (
		repoUrl.startsWith("/") ||
		repoUrl.startsWith("file://") ||
		/^[A-Za-z]:[\\/]/.test(repoUrl) // Windows paths like C:\
	) {
		return "local";
	}

	// GitHub
	if (repoUrl.includes("github.com")) {
		return "github";
	}

	// GitLab
	if (repoUrl.includes("gitlab.com") || repoUrl.includes("gitlab.")) {
		return "gitlab";
	}

	// Bitbucket
	if (repoUrl.includes("bitbucket.org") || repoUrl.includes("bitbucket.")) {
		return "bitbucket";
	}

	// Default to local for unknown (could be a local path without leading /)
	return "local";
}

/**
 * Parse a repo URL into adapter configuration
 */
export function parseRepoUrl(repoUrl: string): RepoConfig {
	const type = detectAdapterType(repoUrl);

	switch (type) {
		case "local": {
			const localPath = repoUrl.replace(/^file:\/\//, "");
			return { type: "local", localPath };
		}

		case "github": {
			// Match: https://github.com/owner/repo
			//        git@github.com:owner/repo.git
			//        github.com/owner/repo
			const match = repoUrl.match(
				/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/,
			);
			if (!match) {
				throw new Error(`Invalid GitHub URL: ${repoUrl}`);
			}
			return {
				type: "github",
				github: {
					owner: match[1],
					repo: match[2],
					installationId: 0, // Must be set separately
				},
			};
		}

		case "gitlab": {
			const match = repoUrl.match(
				/gitlab[^/]*[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/,
			);
			if (!match) {
				throw new Error(`Invalid GitLab URL: ${repoUrl}`);
			}
			return {
				type: "gitlab",
				gitlab: {
					owner: match[1],
					repo: match[2],
					token: "", // Must be set separately
				},
			};
		}

		case "bitbucket": {
			throw new Error("Bitbucket adapter not yet implemented");
		}

		case "sandbox": {
			throw new Error("Sandbox adapter not yet implemented");
		}

		default:
			throw new Error(`Unknown adapter type: ${type}`);
	}
}

/**
 * Create a repo adapter from configuration
 */
export function createRepoAdapter(config: RepoConfig): RepoAdapter {
	switch (config.type) {
		case "local": {
			if (!config.localPath) {
				throw new Error("Local path is required for local adapter");
			}
			return new LocalRepoAdapter(config.localPath);
		}

		case "github": {
			if (!config.github) {
				throw new Error("GitHub config is required for GitHub adapter");
			}
			return new GitHubRepoAdapter(config.github);
		}

		case "gitlab":
			throw new Error("GitLab adapter not yet implemented");

		case "bitbucket":
			throw new Error("Bitbucket adapter not yet implemented");

		case "sandbox":
			throw new Error("Sandbox adapter not yet implemented");

		default:
			throw new Error(`Unknown adapter type: ${config.type}`);
	}
}

/**
 * Create a repo adapter directly from a repo URL
 *
 * Note: For GitHub/GitLab, you may need to set additional auth config after parsing
 */
export function createRepoAdapterFromUrl(repoUrl: string): RepoAdapter {
	const config = parseRepoUrl(repoUrl);
	return createRepoAdapter(config);
}

/**
 * Helper to get a repo adapter for a project
 * Returns null if no repo URL is configured
 */
export async function getRepoAdapterForProject(project: {
	repoUrl: string | null;
}): Promise<RepoAdapter | null> {
	if (!project.repoUrl) {
		return null;
	}

	const config = parseRepoUrl(project.repoUrl);

	// For GitHub, we need to look up the installation
	if (config.type === "github") {
		// TODO: Look up GitHubInstallation from database
		// For now, throw if no installationId
		if (!config.github?.installationId) {
			throw new Error(
				"GitHub repos require installation. Please connect your repository first.",
			);
		}
	}

	return createRepoAdapter(config);
}
