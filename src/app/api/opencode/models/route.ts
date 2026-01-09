import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

import {
	getProjectStorage,
	handleProjectRouteError,
} from "@/lib/projects/server";

const execFileAsync = promisify(execFile);

let cachedModels: string[] | null = null;
let pendingFetch: Promise<string[]> | null = null;

class OpencodeModelsError extends Error {}

function parseModelOutput(output: string): string[] {
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

async function runOpencodeModels(): Promise<string[]> {
	try {
		const { stdout } = await execFileAsync("opencode", ["models"]);
		return parseModelOutput(stdout);
	} catch (error) {
		if (error && typeof error === "object") {
			const execError = error as NodeJS.ErrnoException & { stderr?: string };
			if (execError.code === "ENOENT") {
				throw new OpencodeModelsError(
					"opencode CLI is not installed or not on the PATH.",
				);
			}
			const stderr =
				typeof execError.stderr === "string" ? execError.stderr.trim() : "";
			if (stderr.length) {
				throw new OpencodeModelsError(`opencode models failed: ${stderr}`);
			}
		}
		throw new OpencodeModelsError("Failed to list opencode models.");
	}
}

async function getCachedOpencodeModels(): Promise<string[]> {
	if (cachedModels) {
		return cachedModels;
	}

	if (!pendingFetch) {
		pendingFetch = runOpencodeModels()
			.then((models) => {
				cachedModels = models;
				return models;
			})
			.finally(() => {
				pendingFetch = null;
			});
	}

	return pendingFetch;
}

export async function GET(request: Request) {
	try {
		await getProjectStorage(request);
		const models = await getCachedOpencodeModels();
		return NextResponse.json({ models });
	} catch (error) {
		if (error instanceof OpencodeModelsError) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}
		return handleProjectRouteError(error);
	}
}
