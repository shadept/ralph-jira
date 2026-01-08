import { spawn } from 'node:child_process';
import { NextResponse } from 'next/server';
import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';
import { readRun, upsertRun } from '@/lib/runs/store';

function resolveRunnerCommand(params: {
    mode: 'local' | 'docker';
    projectPath: string;
    runId: string;
}) {
    const scriptArgs = ['tools/runner/run-loop.mjs', '--runId', params.runId];
    if (params.mode === 'local') {
        scriptArgs.push('--projectPath', params.projectPath);
        return {
            command: 'node',
            args: scriptArgs,
            cwd: params.projectPath,
        } as const;
    }

    scriptArgs.push('--projectPath', '/workspace');
    return {
        command: 'docker',
        args: ['compose', 'run', '--rm', 'runner', 'node', ...scriptArgs],
        cwd: params.projectPath,
    } as const;
}

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

        // Reset run state for retry
        const updatedRun = await upsertRun(project.path, run, {
            status: 'queued',
            startedAt: null,
            finishedAt: null,
            reason: undefined,
            lastMessage: 'Retrying run...',
            errors: [],
            commands: [],
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
