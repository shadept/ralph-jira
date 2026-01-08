'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, FolderOpen, Sparkle } from '@phosphor-icons/react';
import { toast } from 'sonner';

import { Board } from '@/lib/schemas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjectContext } from '@/components/projects/project-provider';
import { AppLayout } from '@/components/layout/app-layout';
import { BoardPropertiesDialog } from '@/components/board-properties-dialog';

export default function DashboardPage() {
  const router = useRouter();
  const { currentProject, loading: projectLoading, apiFetch } = useProjectContext();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadBoards = useCallback(async () => {
    if (!currentProject) {
      setBoards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/boards');
      const data = await res.json();
      setBoards(data.boards);
    } catch (error) {
      toast.error('Failed to load boards');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentProject]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const handleCreateBoard = async (newBoard: Board) => {
    if (!currentProject) return;

    try {
      const res = await apiFetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBoard),
      });

      if (!res.ok) throw new Error('Failed to create board');

      toast.success('Board created');
      setCreateDialogOpen(false);
      router.push(`/board/${newBoard.id}`);
    } catch (error) {
      toast.error('Failed to create board');
      console.error(error);
    }
  };

  const getStatusColor = (status: Board['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-700 dark:text-green-300';
      case 'planned':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
      case 'completed':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-300';
      case 'archived':
        return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
      default:
        return '';
    }
  };

  const actions = currentProject ? (
    <Button onClick={() => setCreateDialogOpen(true)}>
      <Plus className="w-4 h-4 mr-2" />
      New Board
    </Button>
  ) : undefined;

  const activeBoard = useMemo(
    () => boards.find(b => b.id === 'prd' || b.id === 'initial-sprint'),
    [boards]
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
            Use the project picker in the top right corner to add or switch projects. Ralph will scaffold any missing planning files for you.
          </p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading boards…</p>
        </div>
      );
    }

    return (
      <div className="space-y-10">
        {activeBoard && (
          <section>
            <Card className="border-primary/40">
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{activeBoard.name}</CardTitle>
                      <Badge className={getStatusColor(activeBoard.status)}>
                        {activeBoard.status}
                      </Badge>
                    </div>
                    <CardDescription>{activeBoard.goal}</CardDescription>
                  </div>
                  <Button onClick={() => router.push(`/board/${activeBoard.id}`)}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Open Board
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <Stat label="Total Tasks" value={activeBoard.tasks.length} />
                  <Stat label="Completed" value={activeBoard.tasks.filter(t => t.status === 'done').length} />
                  <Stat label="In Progress" value={activeBoard.tasks.filter(t => t.status === 'in_progress').length} />
                  <div>
                    <p className="text-muted-foreground">Deadline</p>
                    <p className="text-lg font-semibold">
                      {format(new Date(activeBoard.deadline), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">All Boards</h2>
            <Button variant="ghost" size="sm" onClick={loadBoards}>
              Refresh
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {boards.map(board => (
              <Card
                key={board.id}
                className="cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => router.push(`/board/${board.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-lg">{board.name}</CardTitle>
                    <Badge className={getStatusColor(board.status)}>{board.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{board.goal}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{board.tasks.length} tasks</span>
                    <span>{board.tasks.filter(t => t.status === 'done').length} done</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {boards.length === 0 && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle>No boards yet</CardTitle>
                  <CardDescription>
                    Kick off your first sprint by creating a new board.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Board
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => router.push('/settings')}>
              <CardHeader>
                <CardTitle className="text-lg">Settings</CardTitle>
                <CardDescription>Configure project settings and AI preferences</CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => router.push('/files')}>
              <CardHeader>
                <CardTitle className="text-lg">Files</CardTitle>
                <CardDescription>View planning artifacts and progress logs</CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => router.push('/assistant')}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkle className="w-5 h-5" />
                  AI Assistant
                </CardTitle>
                <CardDescription>Chat with AI to manage your project</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </div>
    );
  };

  return (
    <AppLayout
      title="Project Management"
      description="Manage your sprints and tasks with AI assistance"
      actions={actions}
    >
      {renderContent()}

      <BoardPropertiesDialog
        board={null}
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSave={handleCreateBoard}
        mode="create"
      />
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
