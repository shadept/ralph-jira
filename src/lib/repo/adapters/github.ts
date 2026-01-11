/**
 * GitHub Repository Adapter (Placeholder)
 *
 * TODO: Implement using Octokit with GitHub App installation tokens
 *
 * Will provide file access for GitHub repositories via the GitHub API.
 * Requires a GitHub App installation with Contents read permission.
 */

import type {
	FileContent,
	FileNode,
	GetFileTreeOptions,
	GlobOptions,
	ReadFileOptions,
	RepoAdapter,
	SearchMatch,
	SearchOptions,
} from "../types";

export interface GitHubRepoConfig {
	owner: string;
	repo: string;
	branch?: string;
	installationId: number;
}

export class GitHubRepoAdapter implements RepoAdapter {
	constructor(config: GitHubRepoConfig) {
		this.config = config;
	}

	async getFileTree(_options?: GetFileTreeOptions): Promise<FileNode[]> {
		// TODO: Implement using Octokit
		// const octokit = await getInstallationOctokit(this.config.installationId);
		// const { data } = await octokit.git.getTree({
		//   owner: this.config.owner,
		//   repo: this.config.repo,
		//   tree_sha: this.config.branch || 'main',
		//   recursive: 'true',
		// });
		throw new Error(
			"GitHub adapter not yet implemented. Please connect a local repository for now.",
		);
	}

	async readFile(
		_path: string,
		_options?: ReadFileOptions,
	): Promise<FileContent | null> {
		// TODO: Implement using Octokit
		// const octokit = await getInstallationOctokit(this.config.installationId);
		// const { data } = await octokit.repos.getContent({
		//   owner: this.config.owner,
		//   repo: this.config.repo,
		//   path,
		//   ref: this.config.branch,
		// });
		// if ('content' in data) {
		//   return {
		//     path,
		//     content: Buffer.from(data.content, 'base64').toString('utf-8'),
		//   };
		// }
		throw new Error(
			"GitHub adapter not yet implemented. Please connect a local repository for now.",
		);
	}

	async readFiles(
		_paths: string[],
		_options?: ReadFileOptions,
	): Promise<FileContent[]> {
		throw new Error(
			"GitHub adapter not yet implemented. Please connect a local repository for now.",
		);
	}

	async glob(_pattern: string, _options?: GlobOptions): Promise<string[]> {
		// TODO: GitHub doesn't have native glob - need to fetch tree and filter client-side
		throw new Error(
			"GitHub adapter not yet implemented. Please connect a local repository for now.",
		);
	}

	async search(
		_pattern: string,
		_options?: SearchOptions,
	): Promise<SearchMatch[]> {
		// TODO: Could use GitHub Code Search API or fetch files and search locally
		throw new Error(
			"GitHub adapter not yet implemented. Please connect a local repository for now.",
		);
	}

	async exists(_path: string): Promise<boolean> {
		throw new Error(
			"GitHub adapter not yet implemented. Please connect a local repository for now.",
		);
	}
}
