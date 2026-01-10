import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContextFromParams,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

const DEFAULT_SETTINGS = {
	techStack: [],
	howToTest: { commands: [], notes: "" },
	howToRun: { commands: [], notes: "" },
	aiPreferences: {
		defaultModel: "gpt-4",
		provider: "openai",
		guardrails: [],
	},
	repoConventions: { folders: {}, naming: "" },
	automation: {
		setup: [],
		maxIterations: 5,
		agent: {
			name: "claude",
			model: "opus",
			permissionMode: "bypassPermissions",
			extraArgs: [],
		},
		codingStyle: "",
	},
};

function formatSettings(settings: {
	projectName: string;
	projectDescription: string;
	techStackJson: string;
	howToTestJson: string;
	howToRunJson: string;
	aiPreferencesJson: string;
	repoConventionsJson: string;
	automationJson: string | null;
}) {
	return {
		projectName: settings.projectName,
		projectDescription: settings.projectDescription,
		techStack: JSON.parse(settings.techStackJson),
		howToTest: JSON.parse(settings.howToTestJson),
		howToRun: JSON.parse(settings.howToRunJson),
		aiPreferences: JSON.parse(settings.aiPreferencesJson),
		repoConventions: JSON.parse(settings.repoConventionsJson),
		automation: settings.automationJson
			? JSON.parse(settings.automationJson)
			: DEFAULT_SETTINGS.automation,
	};
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id);

		const settings = await prisma.projectSettings.findUnique({
			where: { projectId: project.id },
		});

		if (!settings) {
			return NextResponse.json({
				settings: {
					projectName: project.name,
					projectDescription: project.description || "",
					...DEFAULT_SETTINGS,
				},
			});
		}

		return NextResponse.json({ settings: formatSettings(settings) });
	} catch (error) {
		console.error("Error fetching project settings:", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { project } = await getProjectContextFromParams(id);
		const updates = await request.json();

		const existing = await prisma.projectSettings.findUnique({
			where: { projectId: project.id },
		});

		const data = {
			projectName: updates.projectName ?? existing?.projectName ?? project.name,
			projectDescription:
				updates.projectDescription ??
				existing?.projectDescription ??
				project.description ??
				"",
			techStackJson: updates.techStack
				? JSON.stringify(updates.techStack)
				: (existing?.techStackJson ?? "[]"),
			howToTestJson: updates.howToTest
				? JSON.stringify(updates.howToTest)
				: (existing?.howToTestJson ?? '{"commands":[],"notes":""}'),
			howToRunJson: updates.howToRun
				? JSON.stringify(updates.howToRun)
				: (existing?.howToRunJson ?? '{"commands":[],"notes":""}'),
			aiPreferencesJson: updates.aiPreferences
				? JSON.stringify(updates.aiPreferences)
				: (existing?.aiPreferencesJson ??
					'{"defaultModel":"gpt-4","provider":"openai","guardrails":[]}'),
			repoConventionsJson: updates.repoConventions
				? JSON.stringify(updates.repoConventions)
				: (existing?.repoConventionsJson ?? '{"folders":{},"naming":""}'),
			automationJson: updates.automation
				? JSON.stringify(updates.automation)
				: (existing?.automationJson ?? null),
		};

		// Update project name and description if provided
		if (
			updates.projectName !== undefined ||
			updates.projectDescription !== undefined
		) {
			await prisma.project.update({
				where: { id: project.id },
				data: {
					...(updates.projectName !== undefined && {
						name: updates.projectName,
					}),
					...(updates.projectDescription !== undefined && {
						description: updates.projectDescription,
					}),
					updatedAt: new Date(),
				},
			});
		}

		const settings = existing
			? await prisma.projectSettings.update({
					where: { projectId: project.id },
					data,
				})
			: await prisma.projectSettings.create({
					data: {
						projectId: project.id,
						...data,
					},
				});

		return NextResponse.json({
			success: true,
			settings: formatSettings(settings),
		});
	} catch (error) {
		console.error("Error updating project settings:", error);
		return handleProjectRouteError(error);
	}
}
