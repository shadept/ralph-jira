'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ProjectMetadata } from '@/lib/projects/types';
import { ProjectErrorDialog } from './project-error-dialog';

interface ProjectErrorState {
  projectId: string;
  message: string;
  details?: string;
}

interface ProjectContextValue {
  projects: ProjectMetadata[];
  currentProject: ProjectMetadata | null;
  loading: boolean;
  projectError: ProjectErrorState | null;
  selectProject: (projectId: string) => void;
  refreshProjects: () => Promise<void>;
  addProject: (payload: { name: string; path: string }) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
  regenerateProject: (projectId: string) => Promise<void>;
  apiFetch: (url: string, init?: RequestInit, options?: { projectId?: string }) => Promise<Response>;
  clearProjectError: () => void;
  triggerProjectError: (error: ProjectErrorState) => void;
}

const STORAGE_KEY = 'ralph-current-project';

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const appendProjectQuery = (url: string, projectId: string) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}projectId=${encodeURIComponent(projectId)}`;
};

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectError, setProjectError] = useState<ProjectErrorState | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId(prev => {
      if (prev && projects.some(project => project.id === prev)) {
        return prev;
      }

      let storedId: string | null = null;
      if (typeof window !== 'undefined') {
        storedId = window.localStorage.getItem(STORAGE_KEY);
      }

      if (storedId && projects.some(project => project.id === storedId)) {
        return storedId;
      }

      return projects[0].id;
    });
  }, [projects]);

  const currentProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(project => project.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, projectId);
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    await loadProjects();
  }, [loadProjects]);

  const apiFetch = useCallback(async (url: string, init?: RequestInit, options?: { projectId?: string }) => {
    const projectId = options?.projectId || currentProject?.id;
    if (!projectId) {
      throw new Error('No project selected');
    }

    const targetUrl = appendProjectQuery(url, projectId);
    const response = await fetch(targetUrl, init);

    if (!response.ok) {
      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (payload?.code === 'PROJECT_INVALID') {
        setProjectError({
          projectId,
          message: payload.error || 'Project data is invalid',
          details: payload.details,
        });
      } else if (payload?.code === 'PROJECT_NOT_FOUND') {
        toast.error('Selected project no longer exists');
        await refreshProjects();
      }

      const message = payload?.error || 'Request failed';
      throw new Error(message);
    }

    return response;
  }, [currentProject?.id, refreshProjects]);

  const addProject = useCallback(async ({ name, path }: { name: string; path: string }) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to add project');
    }

    const data = await res.json();
    await refreshProjects();
    selectProject(data.project.id);
    toast.success('Project added');
  }, [refreshProjects, selectProject]);

  const removeProject = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to delete project');
    }

    await refreshProjects();
    toast.success('Project removed');

    if (selectedProjectId === projectId) {
      const fallback = projects.find(project => project.id !== projectId);
      if (fallback) {
        selectProject(fallback.id);
      } else {
        setSelectedProjectId(null);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, [projects, refreshProjects, selectProject, selectedProjectId]);

  const regenerateProject = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/regenerate`, { method: 'POST' });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to regenerate project');
    }

    const data = await res.json().catch(() => ({}));
    const backupSuffix = data?.backupPath ? ` (backup: ${data.backupPath})` : '';
    toast.success(`Project regenerated${backupSuffix}`);
    setProjectError(null);
  }, []);

  const clearProjectError = useCallback(() => setProjectError(null), []);
  const triggerProjectError = useCallback((error: ProjectErrorState) => setProjectError(error), []);

  const value: ProjectContextValue = {
    projects,
    currentProject,
    loading,
    projectError,
    selectProject,
    refreshProjects,
    addProject,
    removeProject,
    regenerateProject,
    apiFetch,
    clearProjectError,
    triggerProjectError,
  };

  const errorProjectMeta = projectError
    ? projects.find(project => project.id === projectError.projectId)
    : null;

  return (
    <ProjectContext.Provider value={value}>
      {children}
      {projectError && (
        <ProjectErrorDialog
          projectId={projectError.projectId}
          projectName={errorProjectMeta?.name}
          message={projectError.message}
          details={projectError.details}
          onClose={clearProjectError}
          onRegenerate={() => regenerateProject(projectError.projectId)}
          onRemove={async () => {
            await removeProject(projectError.projectId);
            clearProjectError();
          }}
        />
      )}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}
