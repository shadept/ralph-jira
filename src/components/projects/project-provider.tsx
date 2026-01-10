"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { ProjectMetadata } from "@/lib/projects/types";
import { ProjectErrorDialog } from "./project-error-dialog";

interface ProjectErrorState {
	projectId: string;
	message: string;
	details?: string;
}

interface ProjectErrorPayload {
	error?: string;
	code?: string;
	details?: string;
}

interface ProjectContextValue {
	projects: ProjectMetadata[];
	currentProject: ProjectMetadata | null;
	loading: boolean;
	projectError: ProjectErrorState | null;
	selectProject: (projectId: string) => void;
	refreshProjects: () => Promise<void>;
	addProject: (payload: { name: string; repoUrl?: string }) => Promise<void>;
	removeProject: (projectId: string) => Promise<void>;
	apiFetch: (
		url: string,
		init?: RequestInit,
		options?: { projectId?: string }
	) => Promise<Response>;
	clearProjectError: () => void;
	triggerProjectError: (error: ProjectErrorState) => void;
}

const STORAGE_KEY = "ralph-current-project";

const ProjectContext = createContext<ProjectContextValue | undefined>(
	undefined
);

/**
 * Rewrites API URLs to use the new project-scoped hierarchy.
 * - /api/settings -> /api/projects/{id}/settings
 * - /api/sprints -> /api/projects/{id}/sprints
 * - /api/sprints/{sprintId} -> /api/projects/{id}/sprints/{sprintId}
 * - /api/boards -> /api/projects/{id}/sprints
 * - /api/boards/{boardId} -> /api/projects/{id}/sprints/{boardId}
 * - /api/runs -> /api/projects/{id}/runs
 * - /api/runs/start -> /api/projects/{id}/runs/start
 * - /api/runs/{runId}/* -> unchanged (direct run access)
 */
const rewriteApiUrl = (url: string, projectId: string): string => {
	// Parse the URL to handle query params
	const [path, queryString] = url.split("?");
	const query = queryString ? `?${queryString}` : "";

	// /api/settings -> /api/projects/{id}/settings
	if (path === "/api/settings") {
		return `/api/projects/${projectId}/settings${query}`;
	}

	// /api/sprints/* -> /api/projects/{id}/sprints/*
	if (path === "/api/sprints") {
		return `/api/projects/${projectId}/sprints${query}`;
	}
	const sprintsMatch = path.match(/^\/api\/sprints\/([^/]+)(\/.*)?$/);
	if (sprintsMatch) {
		const sprintId = sprintsMatch[1];
		const rest = sprintsMatch[2] || "";
		return `/api/projects/${projectId}/sprints/${sprintId}${rest}${query}`;
	}

	// /api/boards/* -> /api/projects/{id}/sprints/* (boards are sprints)
	if (path === "/api/boards") {
		return `/api/projects/${projectId}/sprints${query}`;
	}
	const boardsMatch = path.match(/^\/api\/boards\/([^/]+)(\/.*)?$/);
	if (boardsMatch) {
		const boardId = boardsMatch[1];
		const rest = boardsMatch[2] || "";
		return `/api/projects/${projectId}/sprints/${boardId}${rest}${query}`;
	}

	// /api/tasks -> /api/projects/{id}/tasks
	if (path === "/api/tasks") {
		return `/api/projects/${projectId}/tasks${query}`;
	}
	// /api/tasks/{taskId} -> /api/projects/{id}/tasks/{taskId}
	const tasksMatch = path.match(/^\/api\/tasks\/([^/]+)(\/.*)?$/);
	if (tasksMatch) {
		const taskId = tasksMatch[1];
		const rest = tasksMatch[2] || "";
		return `/api/projects/${projectId}/tasks/${taskId}${rest}${query}`;
	}

	// /api/runs/start -> /api/projects/{id}/runs/start
	if (path === "/api/runs/start") {
		return `/api/projects/${projectId}/runs/start${query}`;
	}

	// /api/runs (list) -> /api/projects/{id}/runs
	if (path === "/api/runs") {
		return `/api/projects/${projectId}/runs${query}`;
	}

	// /api/runs/{runId}/* -> unchanged (direct run access, still needs projectId query)
	const runsMatch = path.match(/^\/api\/runs\/([^/]+)(\/.*)?$/);
	if (runsMatch) {
		// Direct run access - keep projectId as query param for now
		const separator = query ? "&" : "?";
		return `${url}${separator}projectId=${encodeURIComponent(projectId)}`;
	}

	// Default: append projectId as query param for backward compatibility
	const separator = query ? "&" : "?";
	return `${url}${separator}projectId=${encodeURIComponent(projectId)}`;
};

export function ProjectProvider({ children }: { children: React.ReactNode }) {
	const { status: sessionStatus } = useSession();
	const [projects, setProjects] = useState<ProjectMetadata[]>([]);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [projectError, setProjectError] = useState<ProjectErrorState | null>(
		null
	);

	const loadProjects = useCallback(async () => {
		try {
			const res = await fetch("/api/projects");
			const data = await res.json();
			setProjects(data.projects || []);
		} catch (error) {
			console.error("Failed to load projects:", error);
			toast.error("Failed to load projects");
		} finally {
			setLoading(false);
		}
	}, []);

	// Wait for session to be authenticated before loading projects
	useEffect(() => {
		if (sessionStatus === "authenticated") {
			loadProjects();
		} else if (sessionStatus === "unauthenticated") {
			// Clear projects when not authenticated
			setProjects([]);
			setSelectedProjectId(null);
			setLoading(false);
		}
		// While session is "loading", keep our loading state true
	}, [sessionStatus, loadProjects]);

	useEffect(() => {
		if (!projects.length) {
			setSelectedProjectId(null);
			return;
		}

		setSelectedProjectId((prev) => {
			if (prev && projects.some((project) => project.id === prev)) {
				return prev;
			}

			let storedId: string | null = null;
			if (typeof window !== "undefined") {
				storedId = window.localStorage.getItem(STORAGE_KEY);
			}

			if (storedId && projects.some((project) => project.id === storedId)) {
				return storedId;
			}

			return projects[0].id;
		});
	}, [projects]);

	const currentProject = useMemo(() => {
		if (!selectedProjectId) return null;
		return projects.find((project) => project.id === selectedProjectId) || null;
	}, [projects, selectedProjectId]);

	const selectProject = useCallback((projectId: string) => {
		setSelectedProjectId(projectId);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(STORAGE_KEY, projectId);
		}
	}, []);

	const refreshProjects = useCallback(async () => {
		setLoading(true);
		await loadProjects();
	}, [loadProjects]);

	const apiFetch = useCallback(
		async (
			url: string,
			init?: RequestInit,
			options?: { projectId?: string }
		) => {
			const projectId = options?.projectId || currentProject?.id;
			if (!projectId) {
				throw new Error("No project selected");
			}

			const targetUrl = rewriteApiUrl(url, projectId);
			const response = await fetch(targetUrl, init);

			if (!response.ok) {
				let payload: ProjectErrorPayload | null = null;
				try {
					payload = await response.json();
				} catch {
					payload = null;
				}

				if (payload?.code === "PROJECT_INVALID") {
					setProjectError({
						projectId,
						message: payload.error || "Project data is invalid",
						details: payload.details,
					});
				} else if (payload?.code === "PROJECT_NOT_FOUND") {
					toast.error("Selected project no longer exists");
					await refreshProjects();
				}

				const message = payload?.error || "Request failed";
				throw new Error(message);
			}

			return response;
		},
		[currentProject?.id, refreshProjects]
	);

	const addProject = useCallback(
		async ({ name, repoUrl }: { name: string; repoUrl?: string }) => {
			const res = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, repoUrl }),
			});

			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload.error || "Failed to add project");
			}

			const data = await res.json();
			await refreshProjects();
			selectProject(data.project.id);
			toast.success("Project added");
		},
		[refreshProjects, selectProject]
	);

	const removeProject = useCallback(
		async (projectId: string) => {
			const res = await fetch(`/api/projects/${projectId}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload.error || "Failed to delete project");
			}

			await refreshProjects();
			toast.success("Project removed");

			if (selectedProjectId === projectId) {
				const fallback = projects.find((project) => project.id !== projectId);
				if (fallback) {
					selectProject(fallback.id);
				} else {
					setSelectedProjectId(null);
					if (typeof window !== "undefined") {
						window.localStorage.removeItem(STORAGE_KEY);
					}
				}
			}
		},
		[projects, refreshProjects, selectProject, selectedProjectId]
	);

	const clearProjectError = useCallback(() => setProjectError(null), []);
	const triggerProjectError = useCallback(
		(error: ProjectErrorState) => setProjectError(error),
		[]
	);

	const value: ProjectContextValue = {
		projects,
		currentProject,
		loading,
		projectError,
		selectProject,
		refreshProjects,
		addProject,
		removeProject,
		apiFetch,
		clearProjectError,
		triggerProjectError,
	};

	const errorProjectMeta = projectError
		? projects.find((project) => project.id === projectError.projectId)
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
		throw new Error("useProjectContext must be used within a ProjectProvider");
	}
	return context;
}
