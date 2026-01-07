import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

import { NextResponse } from 'next/server';

import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';
import { Board } from '@/lib/schemas';
import {
  createInitialRunRecord,
  defaultMaxIterations,
  upsertRun,
  writeRun,
} from '@/lib/runs/store';

const PRIORITY_STATUSES = new Set(['in_progress', 'todo']);
const DEFAULT_BOARD_ID = 'prd';

function selectTaskIds(board: Board) {
  return board.tasks
    .filter(task => PRIORITY_STATUSES.has(task.status))
    .map(task => task.id);
}

function resolveBoardId(board: Board, requestedId?: string) {
  if (requestedId && requestedId !== 'prd') return requestedId;
  return board.id;
}

interface RunRequestPayload {
  boardId?: string;
  maxIterations?: number;
}

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

export async function POST(request: Request) {
  try {
    const payload: RunRequestPayload = await request.json().catch(() => ({}));
    const requestedBoardId = payload.boardId || DEFAULT_BOARD_ID;
    const { project, storage } = await getProjectStorage(request);

    const board = await storage.readBoard(requestedBoardId);
    const settings = await storage.readSettings();
    const maxIterations = payload.maxIterations || defaultMaxIterations(settings.automation?.maxIterations, 5);
    const runId = `run-${crypto.randomUUID()}`;
    const executorMode = process.env.RUN_LOOP_EXECUTOR === 'docker' ? 'docker' : 'local';

    const runRecord = createInitialRunRecord({
      runId,
      projectId: project.id,
      boardId: resolveBoardId(board, requestedBoardId),
      boardName: board.name,
      selectedTaskIds: selectTaskIds(board),
      maxIterations,
      executorMode,
    });

    await writeRun(project.path, runRecord);

    const { command, args, cwd } = resolveRunnerCommand({
      mode: executorMode,
      projectPath: project.path,
      runId,
    });

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });
      child.unref();
    } catch (spawnError) {
      await upsertRun(project.path, runRecord, {
        status: 'failed',
        reason: 'error',
        errors: [...runRecord.errors, `Runner spawn failed: ${spawnError}`],
        lastMessage: 'Failed to spawn runner process',
      });
      throw spawnError;
    }

    const runWithPid = await upsertRun(project.path, runRecord, { pid: child.pid ?? undefined });

    return NextResponse.json({ run: runWithPid });
  } catch (error) {
    console.error('Failed to start AI loop run', error);
    return handleProjectRouteError(error);
  }
}
