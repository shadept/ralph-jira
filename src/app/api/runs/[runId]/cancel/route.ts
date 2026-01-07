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

    const updated = await upsertRun(project.path, run, {
      lastMessage: 'Cancellation requested…',
    });

    return NextResponse.json({ run: updated });
  } catch (error) {
    console.error('Failed to cancel run', error);
    return handleProjectRouteError(error);
  }
}
