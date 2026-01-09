import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';
import { cancelFlagPath, readRun, resolveRunnerCommand, upsertRun } from '@/lib/runs/store';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ runId: string }> }
) {
    try {
        const { runId } = await params;
        const { project } = await getProjectStorage(request);

        const run = await readRun(project.path, runId);

        // Only allow retry if it's in a terminal state
        const terminalStatuses = ['completed', 'failed', 'stopped', 'canceled'];
        if (!terminalStatuses.includes(run.status)) {
            return NextResponse.json(
                { error: `Cannot retry a run in status: ${run.status}` },
                { status: 400 }
            );
        }

        // Delete cancel flag if it exists from previous run
        try {
            await fs.unlink(cancelFlagPath(project.path, runId));
        } catch {
            // Ignore if file doesn't exist
        }

        // Reset run state for retry
        const updatedRun = await upsertRun(project.path, run, {
            status: 'queued',
            startedAt: null,
            finishedAt: null,
            reason: undefined,
            lastMessage: 'Retrying run...',
            errors: [],
            commands: [],
            cancellationRequestedAt: undefined,
        });

        const executorMode = run.executorMode || (process.env.RUN_LOOP_EXECUTOR === 'docker' ? 'docker' : 'local');

        const { command, args, cwd } = resolveRunnerCommand({
            mode: executorMode,
            projectPath: project.path,
            runId,
        });

        console.log("Retrying run process", command, args);
        const child = spawn(command, args, {
            cwd,
            detached: true,
            stdio: 'ignore',
            env: { ...process.env },
            windowsHide: true,
        });
        child.unref();

        await upsertRun(project.path, updatedRun, { pid: child.pid ?? undefined });

        return NextResponse.json({ run: updatedRun });
    } catch (error) {
        console.error('Failed to retry run', error);
        return handleProjectRouteError(error);
    }
}
