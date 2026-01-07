'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectContext } from '@/components/projects/project-provider';
import { AppLayout } from '@/components/layout/app-layout';

export default function FilesPage() {
  const { currentProject, loading: projectLoading, apiFetch } = useProjectContext();
  const [progress, setProgress] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProgress = useCallback(async () => {
    if (!currentProject) {
      setProgress('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/progress');
      const data = await res.json();
      setProgress(data.progress);
    } catch (error) {
      toast.error('Failed to load progress log');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentProject]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

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
            Choose a project from the header to view its planning artifacts and progress log.
          </p>
        </div>
      );
    }

    return (
      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList>
          <TabsTrigger value="progress">Progress Log</TabsTrigger>
          <TabsTrigger value="prd">Active Board (prd.json)</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Progress Log</CardTitle>
              <CardDescription>Append-only log of AI runner executions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {loading ? 'Loading…' : progress || 'No progress logged yet'}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prd">
          <Card>
            <CardHeader>
              <CardTitle>plans/prd.json</CardTitle>
              <CardDescription>The active board configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and edit the active board at{' '}
                <a href="/board/prd" className="text-primary underline">
                  /board/prd
                </a>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>plans/settings.json</CardTitle>
              <CardDescription>Project configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and edit settings at{' '}
                <a href="/settings" className="text-primary underline">
                  /settings
                </a>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <AppLayout
      title="Files & Artifacts"
      description="Inspect planning assets, logs, and generated data"
    >
      {renderContent()}
    </AppLayout>
  );
}
