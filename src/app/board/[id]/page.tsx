'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkle, PlayCircle, ArrowLeft, Plus } from '@phosphor-icons/react';

import { Board, Task } from '@/lib/schemas';
import { KanbanBoard } from '@/components/kanban-board';
import { TaskEditorDialog } from '@/components/task-editor-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectContext } from '@/components/projects/project-provider';
import { AppLayout } from '@/components/layout/app-layout';

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { currentProject, loading: projectLoading, apiFetch } = useProjectContext();

  const [board, setBoard] = useState<Board | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
      <Button variant="default">
        <PlayCircle className="w-4 h-4 mr-2" />
        Run AI Loop
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

  return (
    <AppLayout
      title={board ? board.name : 'Board'}
      description={board ? board.goal : 'Plan and track sprint progress'}
      actions={actions}
      fluid
    >

      {renderContent()}
    </AppLayout>
  );
}
