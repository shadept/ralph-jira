import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createStorage } from '@/lib/storage';
import { projectRegistry, ProjectNotFoundError } from './registry';
import type { ProjectMetadata } from './types';

const PROJECT_QUERY_PARAM = 'projectId';

export async function resolveProjectFromRequest(request: Request): Promise<ProjectMetadata> {
  const url = new URL(request.url);
  const projectId = url.searchParams.get(PROJECT_QUERY_PARAM) || undefined;
  return projectRegistry.getProjectOrDefault(projectId);
}

export async function getProjectStorage(request: Request) {
  const project = await resolveProjectFromRequest(request);
  const storage = createStorage(project.path);
  return { project, storage };
}

export function withProjectId(url: string, projectId: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${PROJECT_QUERY_PARAM}=${encodeURIComponent(projectId)}`;
}

export function handleProjectRouteError(error: unknown) {
  if (error instanceof ProjectNotFoundError) {
    return NextResponse.json(
      {
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
        projectId: error.projectId,
      },
      { status: 404 },
    );
  }

  if (isProjectDataError(error)) {
    return NextResponse.json(
      {
        error: 'Project data is invalid',
        code: 'PROJECT_INVALID',
        details: (error as Error).message,
      },
      { status: 400 },
    );
  }

  console.error('Unhandled project route error:', error);
  return NextResponse.json(
    {
      error: 'Internal server error',
    },
    { status: 500 },
  );
}

function isProjectDataError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  if (error instanceof SyntaxError) return true;
  if (error instanceof ZodError) return true;

  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ENOENT') return true;

  return false;
}
