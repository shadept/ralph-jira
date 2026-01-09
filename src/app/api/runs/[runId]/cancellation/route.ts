import { existsSync } from 'node:fs';

import { NextResponse } from 'next/server';

import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';
import { cancelFlagPath } from '@/lib/runs/store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const { project } = await getProjectStorage(request);
    const flagPath = cancelFlagPath(project.path, runId);
    const canceled = existsSync(flagPath);

    return NextResponse.json({ canceled });
  } catch (error) {
    console.error('Failed to check cancellation status', error);
    return handleProjectRouteError(error);
  }
}
