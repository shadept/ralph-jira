import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;

		// Get project and verify access
		const project = await prisma.project.findUnique({
			where: { id, deletedAt: null },
		});

		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		// Verify user has access
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: project.organizationId,
					userId: session.user.id,
				},
			},
		});

		if (!membership) {
			return NextResponse.json({ error: "Access denied" }, { status: 403 });
		}

		// Get settings
		const settings = await prisma.projectSettings.findUnique({
			where: { projectId: id },
		});

		if (!settings) {
			// Return default settings
			return NextResponse.json({
				settings: {
					projectName: project.name,
					projectDescription: project.description || "",
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
				},
			});
		}

		// Transform settings
		const formattedSettings = {
			projectName: settings.projectName,
			projectDescription: settings.projectDescription,
			techStack: JSON.parse(settings.techStackJson),
			howToTest: JSON.parse(settings.howToTestJson),
			howToRun: JSON.parse(settings.howToRunJson),
			aiPreferences: JSON.parse(settings.aiPreferencesJson),
			repoConventions: JSON.parse(settings.repoConventionsJson),
			automation: settings.automationJson
				? JSON.parse(settings.automationJson)
				: undefined,
		};

		return NextResponse.json({ settings: formattedSettings });
	} catch (error) {
		console.error("Error fetching project settings:", error);
		return NextResponse.json(
			{ error: "Failed to fetch settings" },
			{ status: 500 }
		);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const updates = await request.json();

		// Get project and verify access
		const project = await prisma.project.findUnique({
			where: { id, deletedAt: null },
		});

		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		// Verify user has access
		const membership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId: project.organizationId,
					userId: session.user.id,
				},
			},
		});

		if (!membership) {
			return NextResponse.json({ error: "Access denied" }, { status: 403 });
		}

		// Get existing settings
		const existing = await prisma.projectSettings.findUnique({
			where: { projectId: id },
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
				: existing?.techStackJson ?? "[]",
			howToTestJson: updates.howToTest
				? JSON.stringify(updates.howToTest)
				: existing?.howToTestJson ?? '{"commands":[],"notes":""}',
			howToRunJson: updates.howToRun
				? JSON.stringify(updates.howToRun)
				: existing?.howToRunJson ?? '{"commands":[],"notes":""}',
			aiPreferencesJson: updates.aiPreferences
				? JSON.stringify(updates.aiPreferences)
				: existing?.aiPreferencesJson ??
					'{"defaultModel":"gpt-4","provider":"openai","guardrails":[]}',
			repoConventionsJson: updates.repoConventions
				? JSON.stringify(updates.repoConventions)
				: existing?.repoConventionsJson ?? '{"folders":{},"naming":""}',
			automationJson: updates.automation
				? JSON.stringify(updates.automation)
				: existing?.automationJson ?? null,
		};

		// Update project name and description if provided
		const newName = updates.projectName;
		const newDescription = updates.projectDescription;

		if (newName !== undefined || newDescription !== undefined) {
			await prisma.project.update({
				where: { id },
				data: {
					...(newName !== undefined && { name: newName }),
					...(newDescription !== undefined && { description: newDescription }),
					updatedAt: new Date(),
				},
			});
		}

		let settings;
		if (existing) {
			settings = await prisma.projectSettings.update({
				where: { projectId: id },
				data,
			});
		} else {
			settings = await prisma.projectSettings.create({
				data: {
					projectId: id,
					...data,
				},
			});
		}

		// Format response
		const formattedSettings = {
			projectName: settings.projectName,
			projectDescription: settings.projectDescription,
			techStack: JSON.parse(settings.techStackJson),
			howToTest: JSON.parse(settings.howToTestJson),
			howToRun: JSON.parse(settings.howToRunJson),
			aiPreferences: JSON.parse(settings.aiPreferencesJson),
			repoConventions: JSON.parse(settings.repoConventionsJson),
			automation: settings.automationJson
				? JSON.parse(settings.automationJson)
				: undefined,
		};

		return NextResponse.json({ success: true, settings: formattedSettings });
	} catch (error) {
		console.error("Error updating project settings:", error);
		return NextResponse.json(
			{ error: "Failed to update settings" },
			{ status: 500 }
		);
	}
}
