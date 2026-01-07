'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkle, PlayCircle, ArrowLeft, Plus, ClockCounterClockwise } from '@phosphor-icons/react';

import { Board, Task, RunRecord } from '@/lib/schemas';
import { KanbanBoard } from '@/components/kanban-board';
import { TaskEditorDialog } from '@/components/task-editor-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectContext } from '@/components/projects/project-provider';
import { AppLayout } from '@/components/layout/app-layout';

const RUN_TERMINAL_STATUSES = new Set<RunRecord['status']>(['completed', 'failed', 'canceled', 'stopped']);
const RUN_STATUS_BADGES: Record<RunRecord['status'], string> = {
  queued: 'bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-200',
  running: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  stopped: 'bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  completed: 'bg-blue-200 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200',
  failed: 'bg-red-200 text-red-900 dark:bg-red-500/20 dark:text-red-200',
  canceled: 'bg-gray-200 text-gray-900 dark:bg-gray-500/20 dark:text-gray-200',
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { currentProject, loading: projectLoading, apiFetch } = useProjectContext();

  const [board, setBoard] = useState<Board | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeRun, setActiveRun] = useState<RunRecord | null>(null);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [runDrawerOpen, setRunDrawerOpen] = useState(false);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  const closeTaskEditor = () => {
    setIsEditorOpen(false);
    setSelectedTask(null);
  };

  const openTaskEditor = (task: Task) => {
    setSelectedTask(task);
    setIsEditorOpen(true);
  };

  const loadBoard = useCallback(async () => {
    if (!currentProject) {
      setBoard(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/api/boards/${id}`);
      const data = await res.json();
      setBoard(data.board);
    } catch (error) {
      toast.error('Failed to load board');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentProject, id]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!currentProject) {
      setActiveRun(null);
      setRunLog([]);
      setPollingRunId(null);
      setRunDrawerOpen(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (!currentProject) return;
    (async () => {
      try {
        const res = await apiFetch('/api/runs');
        const data = await res.json();
        const runs: RunRecord[] = data.runs || [];
        const running = runs.find(run => run.status === 'running');
        if (running) {
          setActiveRun(running);
          setRunDrawerOpen(true);
          setPollingRunId(running.runId);
        } else if (runs.length) {
          setActiveRun(runs[0]);
        } else {
          setActiveRun(null);
          setRunLog([]);
        }
      } catch (error) {
        console.error('Failed to load runs snapshot', error);
      }
    })();
  }, [apiFetch, currentProject]);

  const fetchRunStatus = useCallback(async (runId: string) => {
    try {
      const res = await apiFetch(`/api/runs/${runId}?tail=120`);
      const data = await res.json();
      setActiveRun(data.run);
      setRunLog(data.log || []);
      if (RUN_TERMINAL_STATUSES.has(data.run.status)) {
        setPollingRunId(null);
        setRunLoading(false);
        await loadBoard();
      }
    } catch (error) {
      console.error('Failed to fetch run status', error);
    }
  }, [apiFetch, loadBoard]);

  useEffect(() => {
    if (!pollingRunId) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      await fetchRunStatus(pollingRunId);
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollingRunId, fetchRunStatus]);

  const handleUpdateBoard = async (updatedBoard: Board) => {
    if (!currentProject) return;
    try {
      const res = await apiFetch(`/api/boards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBoard),
      });

      const data = await res.json();
      setBoard(data.board);
      toast.success('Board updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update board';
      toast.error(message);
      console.error('Board update error:', error);
    }
  };

  const handleTaskClick = (task: Task) => {
    openTaskEditor(task);
  };

  const handleNewTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      category: 'functional',
      description: '',
      steps: [],
      passes: false,
      status: 'backlog',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      filesTouched: [],
    };
    openTaskEditor(newTask);
  };

  const handleSaveTask = async (task: Task) => {
    if (!board) return;

    const timestamp = new Date().toISOString();
    const preparedTask = {
      ...task,
      createdAt: task.createdAt || timestamp,
      updatedAt: timestamp,
    };

    const existingIndex = board.tasks.findIndex(t => t.id === preparedTask.id);
    const updatedTasks = [...board.tasks];

    if (existingIndex >= 0) {
      updatedTasks[existingIndex] = preparedTask;
    } else {
      updatedTasks.push(preparedTask);
    }

    const updatedBoard = {
      ...board,
      tasks: updatedTasks,
      updatedAt: timestamp,
    };

    await handleUpdateBoard(updatedBoard);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!board) return;

    const updatedBoard = {
      ...board,
      tasks: board.tasks.filter(t => t.id !== taskId),
      updatedAt: new Date().toISOString(),
    };

    await handleUpdateBoard(updatedBoard);
    closeTaskEditor();
  };

  const handleAIBoardAction = async (action: string) => {
    if (!board || !currentProject) return;

    try {
      toast.info('AI is working...');

      await apiFetch('/api/ai/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          boardId: id,
          data: {},
        }),
      });

      await loadBoard();
      toast.success('AI action completed');
    } catch (error) {
      toast.error('AI action failed');
      console.error(error);
    }
  };

  const handleStartRun = async () => {
    if (!currentProject) return;
    if (activeRun?.status === 'running') {
      toast.info('AI loop already running');
      setRunDrawerOpen(true);
      return;
    }

    setRunLoading(true);
    try {
      const res = await apiFetch('/api/runs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: id }),
      });
      const data = await res.json();
      setActiveRun(data.run);
      setRunLog([]);
      setRunDrawerOpen(true);
      setPollingRunId(data.run.runId);
      toast.success('AI loop started');
      await fetchRunStatus(data.run.runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start AI loop';
      toast.error(message);
      console.error('Run start error:', error);
    } finally {
      setRunLoading(false);
    }
  };

  const handleCancelRun = async () => {
    if (!activeRun) return;
    try {
      await apiFetch(`/api/runs/${activeRun.runId}/cancel`, { method: 'POST' });
      toast.success('Cancellation requested');
      await fetchRunStatus(activeRun.runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel run';
      toast.error(message);
      console.error('Cancel run error:', error);
    }
  };

  const isRunActive = activeRun?.status === 'running';

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" className="gap-2" onClick={() => router.push('/')}
        >
        <ArrowLeft className="w-4 h-4" />
        Back to Boards
      </Button>
      <Button variant="outline" onClick={handleNewTask}
        >
        <Plus className="w-4 h-4 mr-2" />
        New Task
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Sparkle className="w-4 h-4 mr-2" />
            AI Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleAIBoardAction('prioritize')}>
            Prioritize Tasks
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAIBoardAction('improve-acceptance')}>
            Improve Acceptance Criteria
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAIBoardAction('split-sprints')}>
            Split into Sprints
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" onClick={() => router.push('/runs')}>
        <ClockCounterClockwise className="w-4 h-4 mr-2" />
        Run History
      </Button>
      <Button variant="default" onClick={handleStartRun} disabled={runLoading || isRunActive}>
        <PlayCircle className="w-4 h-4 mr-2" />
        {isRunActive ? 'Loop Running…' : 'Run AI Loop'}
      </Button>
    </div>
  );


  const renderContent = () => {
    if (projectLoading) {
      return (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading projects…</p>
        </div>
      );
    }

    if (!currentProject) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-semibold">No project selected</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Use the project picker in the header to select or create a workspace.
          </p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading board…</p>
        </div>
      );
    }

    if (!board) {
      return (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Board not found</p>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col gap-6">
        <KanbanBoard
          board={board}
          onUpdateBoard={handleUpdateBoard}
          onTaskClick={handleTaskClick}
        />

        <TaskEditorDialog
          task={selectedTask}
          open={isEditorOpen}
          onClose={closeTaskEditor}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      </div>
    );
  };

  const handleDrawerChange = (open: boolean) => {
    setRunDrawerOpen(open);
  };

  return (
    <AppLayout
      title={board ? board.name : 'Board'}
      description={board ? board.goal : 'Plan and track sprint progress'}
      actions={actions}
      fluid
    >

      {renderContent()}

      <Sheet open={runDrawerOpen && Boolean(activeRun)} onOpenChange={handleDrawerChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>AI Loop Run</SheetTitle>
            <SheetDescription>
              {activeRun ? `Run ID: ${activeRun.runId}` : 'Trigger the loop to see live progress.'}
            </SheetDescription>
          </SheetHeader>
          {activeRun ? (
            <div className="mt-4 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={RUN_STATUS_BADGES[activeRun.status]}>{activeRun.status}</Badge>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">Last message</p>
                  <p className="font-medium text-foreground break-words">
                    {activeRun.lastMessage || '—'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Board</p>
                  <p className="font-medium">{activeRun.boardName || activeRun.boardId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tasks Selected</p>
                  <p className="font-medium">{activeRun.selectedTaskIds.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Iterations</p>
                  <p className="font-medium">{activeRun.currentIteration} / {activeRun.maxIterations}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Executor</p>
                  <p className="font-medium capitalize">{activeRun.executorMode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p className="font-medium">{formatTimestamp(activeRun.startedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Finished</p>
                  <p className="font-medium">{formatTimestamp(activeRun.finishedAt)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => router.push(`/runs/${activeRun.runId}`)}>
                  View Details
                </Button>
                <Button variant="destructive" onClick={handleCancelRun} disabled={!isRunActive}>
                  Cancel Run
                </Button>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Live Log</p>
                <ScrollArea className="h-64 rounded-md border bg-muted/30 p-3">
                  {runLog.length ? (
                    <pre className="text-xs whitespace-pre-wrap leading-relaxed">{runLog.join('\n')}</pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">Waiting for output…</p>
                  )}
                </ScrollArea>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Start a run to monitor progress from this drawer.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
