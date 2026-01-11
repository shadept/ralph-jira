import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
	getProjectContext,
	handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectContext(request);

		// Verify run exists and belongs to project
		const run = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
		});

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		const commands = await prisma.runCommand.findMany({
			where: { runId: run.id },
			orderBy: { startedAt: "asc" },
		});

		return NextResponse.json({
			commands: commands.map((c) => ({
				id: c.id,
				command: c.command,
				args: JSON.parse(c.argsJson),
				cwd: c.cwd,
				exitCode: c.exitCode,
				startedAt: c.startedAt.toISOString(),
				finishedAt: c.finishedAt?.toISOString() || null,
			})),
		});
	} catch (error) {
		console.error("Failed to fetch run commands", error);
		return handleProjectRouteError(error);
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectContext(request);
		const body = await request.json();

		// Verify run exists and belongs to project
		const run = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
		});

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		if (typeof body.command !== "string") {
			return NextResponse.json(
				{ error: "Missing or invalid command field" },
				{ status: 400 },
			);
		}

		const command = await prisma.runCommand.create({
			data: {
				runId: run.id,
				command: body.command,
				argsJson: JSON.stringify(body.args || []),
				cwd: body.cwd || "",
				exitCode: body.exitCode ?? null,
				startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
				finishedAt: body.finishedAt ? new Date(body.finishedAt) : null,
			},
		});

		return NextResponse.json({
			command: {
				id: command.id,
				command: command.command,
				args: JSON.parse(command.argsJson),
				cwd: command.cwd,
				exitCode: command.exitCode,
				startedAt: command.startedAt.toISOString(),
				finishedAt: command.finishedAt?.toISOString() || null,
			},
		});
	} catch (error) {
		console.error("Failed to create run command", error);
		return handleProjectRouteError(error);
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		const { runId } = await params;
		const { project } = await getProjectContext(request);
		const body = await request.json();

		// Verify run exists and belongs to project
		const run = await prisma.run.findFirst({
			where: { runId, projectId: project.id },
		});

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		if (!body.id) {
			return NextResponse.json(
				{ error: "Missing command id" },
				{ status: 400 },
			);
		}

		const command = await prisma.runCommand.update({
			where: { id: body.id },
			data: {
				exitCode: body.exitCode ?? undefined,
				finishedAt: body.finishedAt ? new Date(body.finishedAt) : undefined,
			},
		});

		return NextResponse.json({
			command: {
				id: command.id,
				command: command.command,
				args: JSON.parse(command.argsJson),
				cwd: command.cwd,
				exitCode: command.exitCode,
				startedAt: command.startedAt.toISOString(),
				finishedAt: command.finishedAt?.toISOString() || null,
			},
		});
	} catch (error) {
		console.error("Failed to update run command", error);
		return handleProjectRouteError(error);
	}
}
