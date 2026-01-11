"use client";

import Cookies from "js-cookie";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
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
		options?: { projectId?: string },
	) => Promise<Response>;
	clearProjectError: () => void;
	triggerProjectError: (error: ProjectErrorState) => void;
}

export const PROJECT_COOKIE_KEY = "ralph-selected-project";

const ProjectContext = createContext<ProjectContextValue | undefined>(
	undefined,
);

/**
 * Rewrites API URLs to use the new project-scoped hierarchy.
 */
const rewriteApiUrl = (url: string, projectId: string): string => {
	const [path, queryString] = url.split("?");
	const query = queryString ? `?${queryString}` : "";

	if (path === "/api/settings") {
		return `/api/projects/${projectId}/settings${query}`;
	}

	if (path === "/api/sprints") {
		return `/api/projects/${projectId}/sprints${query}`;
	}
	const sprintsMatch = path.match(/^\/api\/sprints\/([^/]+)(\/.*)?$/);
	if (sprintsMatch) {
		const sprintId = sprintsMatch[1];
		const rest = sprintsMatch[2] || "";
		return `/api/projects/${projectId}/sprints/${sprintId}${rest}${query}`;
	}

	if (path === "/api/boards") {
		return `/api/projects/${projectId}/sprints${query}`;
	}
	const boardsMatch = path.match(/^\/api\/boards\/([^/]+)(\/.*)?$/);
	if (boardsMatch) {
		const boardId = boardsMatch[1];
		const rest = boardsMatch[2] || "";
		return `/api/projects/${projectId}/sprints/${boardId}${rest}${query}`;
	}

	if (path === "/api/tasks") {
		return `/api/projects/${projectId}/tasks${query}`;
	}
	const tasksMatch = path.match(/^\/api\/tasks\/([^/]+)(\/.*)?$/);
	if (tasksMatch) {
		const taskId = tasksMatch[1];
		const rest = tasksMatch[2] || "";
		return `/api/projects/${projectId}/tasks/${taskId}${rest}${query}`;
	}

	if (path === "/api/runs/start") {
		return `/api/projects/${projectId}/runs/start${query}`;
	}

	if (path === "/api/runs") {
		return `/api/projects/${projectId}/runs${query}`;
	}

	const runsMatch = path.match(/^\/api\/runs\/([^/]+)(\/.*)?$/);
	if (runsMatch) {
		const separator = query ? "&" : "?";
		return `${url}${separator}projectId=${encodeURIComponent(projectId)}`;
	}

	const separator = query ? "&" : "?";
	return `${url}${separator}projectId=${encodeURIComponent(projectId)}`;
};

interface ProjectProviderProps {
	children: React.ReactNode;
	/** Projects fetched server-side. If not provided, will fetch client-side. */
	initialProjects?: ProjectMetadata[];
	/** Selected project ID from cookie, read server-side. */
	initialSelectedProjectId?: string | null;
}

export function ProjectProvider({
	children,
	initialProjects,
	initialSelectedProjectId,
}: ProjectProviderProps) {
	// Determine initial selected project ID
	const getInitialSelectedId = (): string | null => {
		if (initialSelectedProjectId && initialProjects?.some(p => p.id === initialSelectedProjectId)) {
			return initialSelectedProjectId;
		}
		if (initialProjects?.length) {
			return initialProjects[0].id;
		}
		return null;
	};

	const [projects, setProjects] = useState<ProjectMetadata[]>(initialProjects ?? []);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(getInitialSelectedId);
	const [loading, setLoading] = useState(!initialProjects);
	const [projectError, setProjectError] = useState<ProjectErrorState | null>(null);

	const loadProjects = useCallback(async () => {
		try {
			const res = await fetch("/api/projects");
			const data = await res.json();
			const newProjects = data.projects || [];
			setProjects(newProjects);

			// Update selected project if current one is no longer valid
			setSelectedProjectId(prev => {
				if (prev && newProjects.some((p: ProjectMetadata) => p.id === prev)) {
					return prev;
				}
				return newProjects.length > 0 ? newProjects[0].id : null;
			});
		} catch (error) {
			console.error("Failed to load projects:", error);
			toast.error("Failed to load projects");
		} finally {
			setLoading(false);
		}
	}, []);

	// If no initial projects provided, fetch on mount
	useEffect(() => {
		if (!initialProjects) {
			loadProjects();
		}
	}, [initialProjects, loadProjects]);

	const currentProject = useMemo(() => {
		if (!selectedProjectId) return null;
		return projects.find((project) => project.id === selectedProjectId) || null;
	}, [projects, selectedProjectId]);

	const selectProject = useCallback((projectId: string) => {
		setSelectedProjectId(projectId);
		// Store in cookie for server-side access
		Cookies.set(PROJECT_COOKIE_KEY, projectId, { expires: 365 });
	}, []);

	const refreshProjects = useCallback(async () => {
		setLoading(true);
		await loadProjects();
	}, [loadProjects]);

	const apiFetch = useCallback(
		async (
			url: string,
			init?: RequestInit,
			options?: { projectId?: string },
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
		[currentProject?.id, refreshProjects],
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
		[refreshProjects, selectProject],
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
					Cookies.remove(PROJECT_COOKIE_KEY);
				}
			}
		},
		[projects, refreshProjects, selectProject, selectedProjectId],
	);

	const clearProjectError = useCallback(() => setProjectError(null), []);
	const triggerProjectError = useCallback(
		(error: ProjectErrorState) => setProjectError(error),
		[],
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
