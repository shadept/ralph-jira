"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import {
	Sparkle,
	PlayCircle,
	Plus,
	ClockCounterClockwise,
	GearSix,
} from "@phosphor-icons/react";

import { Board, Task, RunRecord } from "@/lib/schemas";
import { KanbanBoard } from "@/components/kanban-board";
import { TaskEditorDialog } from "@/components/task-editor-dialog";
import { BoardPropertiesDialog } from "@/components/board-properties-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useProjectContext } from "@/components/projects/project-provider";
import { AppLayout } from "@/components/layout/app-layout";
import { AnsiLog } from "@/components/ansi-log";
import { cn } from "@/lib/utils";

const RUN_TERMINAL_STATUSES = new Set<RunRecord["status"]>([
	"completed",
	"failed",
	"canceled",
	"stopped",
]);
const RUN_STATUS_BADGES: Record<RunRecord["status"], string> = {
	queued:
		"bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-200",
	running:
		"bg-emerald-200 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
	stopped:
		"bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
	completed: "bg-blue-200 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200",
	failed: "bg-red-200 text-red-900 dark:bg-red-500/20 dark:text-red-200",
	canceled: "bg-gray-200 text-gray-900 dark:bg-gray-500/20 dark:text-gray-200",
};

const formatTimestamp = (value?: string | null) => {
	if (!value) return "—";
	try {
		return new Date(value).toLocaleString();
	} catch {
		return value;
	}
};

function StartRunDialog({
	open,
	onOpenChange,
	onStart,
	loading,
	defaultBranchName,
	defaultIterations,
	toKebabCase,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onStart: (branchName: string, maxIterations: number) => Promise<boolean>;
	loading: boolean;
	defaultBranchName: string;
	defaultIterations: number;
	toKebabCase: (value: string) => string;
}) {
	const form = useForm({
		defaultValues: {
			branchName: defaultBranchName,
			maxIterations: defaultIterations,
		},
		onSubmit: async ({ value }) => {
			const normalizedBranch = toKebabCase(value.branchName || defaultBranchName);
			if (!normalizedBranch) {
				return;
			}
			const started = await onStart(normalizedBranch, value.maxIterations);
			if (started) {
				onOpenChange(false);
			}
		},
	});

	useEffect(() => {
		if (open) {
			form.reset();
			form.setFieldValue("branchName", defaultBranchName);
			form.setFieldValue("maxIterations", defaultIterations);
		}
	}, [open, defaultBranchName, defaultIterations, form]);

	const branchValue = form.getFieldValue("branchName");
	const normalizedBranchPreview = toKebabCase(branchValue || defaultBranchName);
	const branchPreviewDiffers =
		branchValue.trim().length > 0 &&
		normalizedBranchPreview !== branchValue.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Start AI Loop</DialogTitle>
					<DialogDescription>
						Provide the branch name the agent should use. The runner will
						create a git worktree on this branch and only cleans up the
						sandbox after commits are pushed to origin.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Field name="branchName">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Branch name</Label>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="run/feature-awesome"
									autoFocus
								/>
								{branchPreviewDiffers && (
									<p className="text-xs text-muted-foreground">
										The new branch will be:{" "}
										<code className="rounded bg-muted px-1 py-0.5 text-[11px]">
											{normalizedBranchPreview}
										</code>
									</p>
								)}
							</div>
						)}
					</form.Field>

					<form.Field name="maxIterations">
						{(field) => (
							<div className="space-y-2 mt-4">
								<Label htmlFor={field.name}>Max Iterations</Label>
								<Input
									id={field.name}
									type="number"
									min={1}
									max={20}
									value={field.state.value}
									onChange={(e) => {
										const val = parseInt(e.target.value, 10);
										field.handleChange(isNaN(val) ? 1 : val);
									}}
								/>
								<p className="text-xs text-muted-foreground">
									Overrides project setting ({defaultIterations}). Max 20
									recommended.
								</p>
							</div>
						)}
					</form.Field>

					<DialogFooter className="mt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? "Starting…" : "Start Run"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function CreateTasksDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (description: string) => Promise<void>;
	loading: boolean;
}) {
	const form = useForm({
		defaultValues: {
			description: "",
		},
		onSubmit: async ({ value }) => {
			if (!value.description.trim()) return;
			await onSubmit(value.description.trim());
		},
	});

	useEffect(() => {
		if (open) {
			form.reset();
		}
	}, [open, form]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create Tasks with AI</DialogTitle>
					<DialogDescription>
						Describe a feature or requirement and AI will generate tasks for
						you.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Field name="description">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Description</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="e.g., Add user authentication with login, registration, and password reset"
									rows={4}
									autoFocus
								/>
								<p className="text-xs text-muted-foreground">
									Be specific about what you want to build. The AI will create
									multiple tasks with acceptance criteria.
								</p>
							</div>
						)}
					</form.Field>

					<DialogFooter className="mt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={loading || !form.getFieldValue("description").trim()}
						>
							{loading ? "Creating…" : "Create Tasks"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default function SprintPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();
	const {
		currentProject,
		loading: projectLoading,
		apiFetch,
	} = useProjectContext();

	// Using Board type for backward compatibility with API response
	const [sprint, setSprint] = useState<Board | null>(null);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [activeRun, setActiveRun] = useState<RunRecord | null>(null);
	const [runLog, setRunLog] = useState<string[]>([]);
	const [runDrawerOpen, setRunDrawerOpen] = useState(false);
	const [pollingRunId, setPollingRunId] = useState<string | null>(null);
	const [runLoading, setRunLoading] = useState(false);
	const [startRunDialogOpen, setStartRunDialogOpen] = useState(false);
	const [sprintRunCount, setSprintRunCount] = useState(0);
	const [defaultIterations, setDefaultIterations] = useState<number>(5);
	const [createTasksDialogOpen, setCreateTasksDialogOpen] = useState(false);
	const [createTasksLoading, setCreateTasksLoading] = useState(false);
	const [sprintPropertiesOpen, setSprintPropertiesOpen] = useState(false);

	const toKebabCase = useCallback((value: string) => {
		const normalized = value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9./_-]+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "");
		return normalized;
	}, []);

	const fallbackBranchBase = useMemo(
		() => toKebabCase(sprint?.name || ""),
		[sprint?.name, toKebabCase],
	);

	const generateDefaultBranchName = useCallback(() => {
		const nextCount = Math.max(sprintRunCount, 0) + 1;
		const suggestion = `${fallbackBranchBase}/run-${nextCount}`;
		return toKebabCase(suggestion);
	}, [sprintRunCount, fallbackBranchBase, toKebabCase]);

	const closeTaskEditor = () => {
		setIsEditorOpen(false);
		setSelectedTask(null);
	};

	const openTaskEditor = (task: Task) => {
		if (activeRun?.status === "running") return;
		setSelectedTask(task);
		setIsEditorOpen(true);
	};

	const loadSprint = useCallback(async () => {
		if (!currentProject) {
			setSprint(null);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const res = await apiFetch(`/api/boards/${id}`);
			const data = await res.json();
			setSprint(data.board);
		} catch (error) {
			toast.error("Failed to load sprint");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject, id]);

	useEffect(() => {
		loadSprint();
	}, [loadSprint]);

	useEffect(() => {
		if (activeRun?.status === "running") {
			setIsEditorOpen(false);
			setSelectedTask(null);
		}
	}, [activeRun?.status]);

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
				const res = await apiFetch("/api/runs");
				const data = await res.json();
				const runs: RunRecord[] = data.runs || [];
				const sprintRuns = runs.filter((run) => run.sprintId === id);
				setSprintRunCount(sprintRuns.length);
				const running = runs.find((run) => run.status === "running");
				if (running) {
					setActiveRun(running);
					setRunDrawerOpen(true);
					setPollingRunId(running.runId);
				} else if (runs.length) {
					setActiveRun(runs[0]);
				}
			} catch (error) {
				console.error("Failed to fetch runs", error);
			}
		})();
	}, [apiFetch, currentProject, id]);

	const fetchRunStatus = useCallback(
		async (runId: string) => {
			try {
				const res = await apiFetch(`/api/runs/${runId}?tail=120`);
				const data = await res.json();
				setActiveRun(data.run);
				setRunLog(data.log || []);
				if (RUN_TERMINAL_STATUSES.has(data.run.status)) {
					setPollingRunId(null);
					setRunLoading(false);
					await loadSprint();
				}
			} catch (error) {
				console.error("Failed to fetch run status", error);
			}
		},
		[apiFetch, loadSprint],
	);

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

	const handleUpdateSprint = async (updatedSprint: Board) => {
		if (!currentProject) return;
		try {
			const res = await apiFetch(`/api/boards/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updatedSprint),
			});

			const data = await res.json();
			setSprint(data.board);
			toast.success("Sprint updated");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update sprint";
			toast.error(message);
			console.error("Sprint update error:", error);
		}
	};

	const handleDeleteSprint = async (sprintId: string) => {
		if (!currentProject) return;
		try {
			await apiFetch(`/api/boards/${sprintId}`, {
				method: "DELETE",
			});
			toast.success("Sprint deleted");
			router.push("/project");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete sprint";
			toast.error(message);
			console.error("Sprint deletion error:", error);
		}
	};

	const handleTaskClick = (task: Task) => {
		openTaskEditor(task);
	};

	const handleNewTask = () => {
		const newTask: Task = {
			id: `task-${Date.now()}`,
			projectId: "default",
			sprintId: id,
			category: "functional",
			description: "",
			acceptanceCriteria: [],
			passes: false,
			status: "backlog",
			priority: "medium",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			tags: [],
			filesTouched: [],
		};
		openTaskEditor(newTask);
	};

	const handleSaveTask = async (task: Task) => {
		if (!sprint) return;

		const timestamp = new Date().toISOString();
		const preparedTask = {
			...task,
			createdAt: task.createdAt || timestamp,
			updatedAt: timestamp,
		};

		const existingIndex = sprint.tasks.findIndex(
			(t) => t.id === preparedTask.id,
		);
		const updatedTasks = [...sprint.tasks];

		if (existingIndex >= 0) {
			updatedTasks[existingIndex] = preparedTask;
		} else {
			updatedTasks.push(preparedTask);
		}

		const updatedSprint = {
			...sprint,
			tasks: updatedTasks,
			updatedAt: timestamp,
		};

		await handleUpdateSprint(updatedSprint);
	};

	const handleDeleteTask = async (taskId: string) => {
		if (!sprint) return;

		const updatedSprint = {
			...sprint,
			tasks: sprint.tasks.filter((t) => t.id !== taskId),
			updatedAt: new Date().toISOString(),
		};

		await handleUpdateSprint(updatedSprint);
		closeTaskEditor();
	};

	const handleCreateTasksClick = () => {
		setCreateTasksDialogOpen(true);
	};

	const handleCreateTasksSubmit = async (description: string) => {
		if (!sprint || !currentProject) return;

		setCreateTasksLoading(true);
		try {
			toast.info("AI is generating tasks...");

			await apiFetch("/api/ai/board", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "generate-tasks",
					boardId: id,
					data: {
						description,
						count: 5,
						category: "functional",
					},
				}),
			});

			await loadSprint();
			toast.success("Tasks created successfully");
			setCreateTasksDialogOpen(false);
		} catch (error) {
			toast.error("Failed to create tasks");
			console.error(error);
		} finally {
			setCreateTasksLoading(false);
		}
	};

	const handleRunButtonClick = () => {
		if (!currentProject) return;
		if (activeRun?.status === "running") {
			toast.info("AI loop already running");
			setRunDrawerOpen(true);
			return;
		}

		apiFetch("/api/settings")
			.then((res) => res.json())
			.then((data) => {
				const projectMax = data.settings?.automation?.maxIterations || 5;
				setDefaultIterations(projectMax);
			})
			.catch((err) => {
				console.error("Failed to fetch settings for iterations default", err);
			});

		setStartRunDialogOpen(true);
	};

	const startRun = async (branchName: string, maxIterations: number) => {
		if (!currentProject) return false;
		if (activeRun?.status === "running") {
			toast.info("AI loop already running");
			setRunDrawerOpen(true);
			return false;
		}

		setRunLoading(true);
		try {
			const res = await apiFetch("/api/runs/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sprintId: id, branchName, maxIterations }),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Failed to start AI loop");
			}
			setActiveRun(data.run);
			setRunLog([]);
			setRunDrawerOpen(true);
			setPollingRunId(data.run.runId);
			setSprintRunCount((prev) => prev + 1);
			toast.success("AI loop started");
			await fetchRunStatus(data.run.runId);
			return true;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to start AI loop";
			toast.error(message);
			console.error("Run start error:", error);
			return false;
		} finally {
			setRunLoading(false);
		}
	};

	const handleCancelRun = async () => {
		if (!activeRun) return;
		try {
			await apiFetch(`/api/runs/${activeRun.runId}/cancel`, { method: "POST" });
			toast.success("Cancellation requested");
			await fetchRunStatus(activeRun.runId);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to cancel run";
			toast.error(message);
			console.error("Cancel run error:", error);
		}
	};

	const isRunActive = activeRun?.status === "running";
	const sprintLocked = isRunActive;

	const actions = (
		<div className="flex flex-wrap items-center gap-2">
			<Button variant="outline" onClick={handleNewTask} disabled={sprintLocked}>
				<Plus className="w-4 h-4 mr-2" />
				New Task
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" disabled={sprintLocked}>
						<Sparkle className="w-4 h-4 mr-2" />
						AI Actions
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem onClick={handleCreateTasksClick}>
						Create Tasks
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Button
				variant="outline"
				onClick={() => setSprintPropertiesOpen(true)}
				disabled={sprintLocked}
			>
				<GearSix className="w-4 h-4 mr-2" />
				Properties
			</Button>
			<Button variant="outline" onClick={() => router.push("/project/runs")}>
				<ClockCounterClockwise className="w-4 h-4 mr-2" />
				Run History
			</Button>
			<Button
				variant="default"
				onClick={handleRunButtonClick}
				disabled={runLoading}
			>
				<PlayCircle className="w-4 h-4 mr-2" />
				{isRunActive ? "Loop Running…" : "Run AI Loop"}
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
						Use the project picker in the header to select or create a
						workspace.
					</p>
				</div>
			);
		}

		if (loading) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading sprint…</p>
				</div>
			);
		}

		if (!sprint) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Sprint not found</p>
				</div>
			);
		}

		return (
			<div className="flex flex-1 flex-col gap-6">
				<div className="relative flex flex-1 flex-col rounded-xl">
					{sprintLocked && (
						<div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-background/70 px-6 text-center backdrop-blur-sm">
							<p className="text-sm font-semibold text-foreground">
								AI loop running
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Sprint edits are temporarily disabled until the run completes or
								is canceled.
							</p>
						</div>
					)}
					<div
						className={cn(
							"flex flex-1 flex-col ",
							sprintLocked && "pointer-events-none opacity-60",
						)}
					>
						<KanbanBoard
							board={sprint}
							onUpdateBoard={handleUpdateSprint}
							onTaskClick={handleTaskClick}
						/>
					</div>
				</div>

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
			title={sprint ? sprint.name : "Sprint"}
			description={sprint ? sprint.goal : "Plan and track sprint progress"}
			actions={actions}
			backLink={{ href: "/project", label: "Back to Project" }}
			fluid
		>
			{renderContent()}

			<Sheet
				open={runDrawerOpen && Boolean(activeRun)}
				onOpenChange={handleDrawerChange}
			>
				<SheetContent side="right" className="w-full sm:max-w-lg">
					<SheetHeader>
						<SheetTitle>AI Loop Run</SheetTitle>
						<SheetDescription>
							{activeRun
								? `Run ID: ${activeRun.runId}`
								: "Trigger the loop to see live progress."}
						</SheetDescription>
					</SheetHeader>
					{activeRun ? (
						<div className="flex flex-1 flex-col p-4 space-y-5">
							<div className="flex items-start justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									<Badge className={RUN_STATUS_BADGES[activeRun.status]}>
										{activeRun.status}
									</Badge>
								</div>
								<div className="text-right text-sm">
									<p className="text-muted-foreground">Last message</p>
									<p className="font-medium text-foreground break-words">
										{activeRun.lastMessage || "—"}
									</p>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p className="text-muted-foreground">Sprint</p>
									<p className="font-medium">
										{activeRun.sprintName || activeRun.sprintId}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Tasks Selected</p>
									<p className="font-medium">
										{activeRun.selectedTaskIds.length}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Iterations</p>
									<p className="font-medium">
										{activeRun.currentIteration} / {activeRun.maxIterations}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Executor</p>
									<p className="font-medium capitalize">
										{activeRun.executorMode}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Branch</p>
									<p className="font-medium break-words">
										{activeRun.sandboxBranch || "—"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Started</p>
									<p className="font-medium">
										{formatTimestamp(activeRun.startedAt)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Finished</p>
									<p className="font-medium">
										{formatTimestamp(activeRun.finishedAt)}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									variant="secondary"
									onClick={() => router.push(`/project/runs/${activeRun.runId}`)}
								>
									View Details
								</Button>
								<Button
									variant="destructive"
									onClick={handleCancelRun}
									disabled={!isRunActive}
								>
									Cancel Run
								</Button>
							</div>
							<div className="flex flex-1 flex-col">
								<p className="text-sm font-medium mb-2">Live Log</p>
								<ScrollArea className="h-full rounded-md border bg-muted/30 p-3">
									{runLog.length ? (
										<AnsiLog content={runLog} className="text-xs" />
									) : (
										<p className="text-sm text-muted-foreground">
											Waiting for output…
										</p>
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

			<StartRunDialog
				open={startRunDialogOpen}
				onOpenChange={setStartRunDialogOpen}
				onStart={startRun}
				loading={runLoading}
				defaultBranchName={generateDefaultBranchName()}
				defaultIterations={defaultIterations}
				toKebabCase={toKebabCase}
			/>

			<CreateTasksDialog
				open={createTasksDialogOpen}
				onOpenChange={setCreateTasksDialogOpen}
				onSubmit={handleCreateTasksSubmit}
				loading={createTasksLoading}
			/>

			<BoardPropertiesDialog
				board={sprint}
				open={sprintPropertiesOpen}
				onClose={() => setSprintPropertiesOpen(false)}
				onSave={handleUpdateSprint}
				onDelete={handleDeleteSprint}
			/>
		</AppLayout>
	);
}
