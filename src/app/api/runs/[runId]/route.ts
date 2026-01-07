import path from 'node:path';

import { NextResponse } from 'next/server';

import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';
import { readRun, tailLog } from '@/lib/runs/store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const { project } = await getProjectStorage(request);
    const run = await readRun(project.path, runId);

    const url = new URL(request.url);
    const tailParam = Number(url.searchParams.get('tail') || '100');
    const tail = Number.isNaN(tailParam) ? 100 : Math.max(10, Math.min(tailParam, 500));

    const sandboxLogPath = run.sandboxLogPath ? path.join(project.path, run.sandboxLogPath) : null;
    const persistedLogPath = run.logPath ? path.join(project.path, run.logPath) : null;

    let logLines: string[] = [];
    if (sandboxLogPath) {
      logLines = await tailLog(sandboxLogPath, tail);
    }
    if (!logLines.length && persistedLogPath) {
      logLines = await tailLog(persistedLogPath, tail);
    }

    return NextResponse.json({ run, log: logLines });
  } catch (error) {
    console.error('Failed to fetch run details', error);
    return handleProjectRouteError(error);
  }
}
