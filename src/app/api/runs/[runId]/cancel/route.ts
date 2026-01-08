import { promises as fs } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';
import { readRun, upsertRun } from '@/lib/runs/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const { project } = await getProjectStorage(request);
    const run = await readRun(project.path, runId);

    const cancelPath = path.join(project.path, run.cancelFlagPath);
    await fs.writeFile(cancelPath, `canceled at ${new Date().toISOString()}`, 'utf-8');

    let lastMessage = 'Cancellation requested…';
    let forceKilled = false;

    if (run.cancellationRequestedAt && run.pid) {
      try {
        // Second time requesting cancellation - kill the process
        process.kill(run.pid, 'SIGTERM');
        lastMessage = 'Process force killed.';
        forceKilled = true;
      } catch (err) {
        console.error(`Failed to kill process ${run.pid}`, err);
        lastMessage = 'Process already dead or could not be killed.';
      }
    }

    const updated = await upsertRun(project.path, run, {
      lastMessage,
      cancellationRequestedAt: run.cancellationRequestedAt || new Date().toISOString(),
      status: 'canceled',
      reason: 'canceled',
      finishedAt: forceKilled ? new Date().toISOString() : run.finishedAt,
    });

    return NextResponse.json({ run: updated });
  } catch (error) {
    console.error('Failed to cancel run', error);
    return handleProjectRouteError(error);
  }
}
