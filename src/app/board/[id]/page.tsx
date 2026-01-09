"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function BoardPage({
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

	const [board, setBoard] = useState<Board | null>(null);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [activeRun, setActiveRun] = useState<RunRecord | null>(null);
	const [runLog, setRunLog] = useState<string[]>([]);
	const [runDrawerOpen, setRunDrawerOpen] = useState(false);
	const [pollingRunId, setPollingRunId] = useState<string | null>(null);
	const [runLoading, setRunLoading] = useState(false);
	const [startRunDialogOpen, setStartRunDialogOpen] = useState(false);
	const [runBranchInput, setRunBranchInput] = useState("");
	const [runBranchError, setRunBranchError] = useState("");
	const [boardRunCount, setBoardRunCount] = useState(0);
	const [runIterationsInput, setRunIterationsInput] = useState<number>(5);
	const [defaultIterations, setDefaultIterations] = useState<number>(5);
	const [createTasksDialogOpen, setCreateTasksDialogOpen] = useState(false);
	const [createTasksDescription, setCreateTasksDescription] = useState("");
	const [createTasksLoading, setCreateTasksLoading] = useState(false);
	const [boardPropertiesOpen, setBoardPropertiesOpen] = useState(false);

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
		() => toKebabCase(board?.name || ""),
		[board?.name, toKebabCase],
	);

	const generateDefaultBranchName = useCallback(() => {
		const nextCount = Math.max(boardRunCount, 0) + 1;
		const suggestion = `${fallbackBranchBase}/run-${nextCount}`;
		return toKebabCase(suggestion);
	}, [boardRunCount, fallbackBranchBase, toKebabCase]);

	const normalizedBranchPreview = useMemo(() => {
		const fallback = generateDefaultBranchName();
		return toKebabCase(runBranchInput || fallback);
	}, [runBranchInput, toKebabCase, generateDefaultBranchName]);
	const branchPreviewDiffers =
		runBranchInput.trim().length > 0 &&
		normalizedBranchPreview !== runBranchInput.trim();

	const closeTaskEditor = () => {
		setIsEditorOpen(false);
		setSelectedTask(null);
	};

	const openTaskEditor = (task: Task) => {
		if (activeRun?.status === "running") return;
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
			toast.error("Failed to load board");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject, id]);

	useEffect(() => {
		loadBoard();
	}, [loadBoard]);

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
				const boardRuns = runs.filter((run) => run.sprintId === id);
				setBoardRunCount(boardRuns.length);
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
					await loadBoard();
				}
			} catch (error) {
				console.error("Failed to fetch run status", error);
			}
		},
		[apiFetch, loadBoard],
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

	const handleUpdateBoard = async (updatedBoard: Board) => {
		if (!currentProject) return;
		try {
			const res = await apiFetch(`/api/boards/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updatedBoard),
			});

			const data = await res.json();
			setBoard(data.board);
			toast.success("Board updated");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update board";
			toast.error(message);
			console.error("Board update error:", error);
		}
	};

	const handleDeleteBoard = async (boardId: string) => {
		if (!currentProject) return;
		try {
			await apiFetch(`/api/boards/${boardId}`, {
				method: "DELETE",
			});
			toast.success("Board deleted");
			router.push("/"); // Navigate back to project list or dashboard
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete board";
			toast.error(message);
			console.error("Board deletion error:", error);
		}
	};

	const handleTaskClick = (task: Task) => {
		openTaskEditor(task);
	};

	const handleNewTask = () => {
		const newTask: Task = {
			id: `task-${Date.now()}`,
			projectId: "default", // Will be set properly by the backend
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
		if (!board) return;

		const timestamp = new Date().toISOString();
		const preparedTask = {
			...task,
			createdAt: task.createdAt || timestamp,
			updatedAt: timestamp,
		};

		const existingIndex = board.tasks.findIndex(
			(t) => t.id === preparedTask.id,
		);
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
			tasks: board.tasks.filter((t) => t.id !== taskId),
			updatedAt: new Date().toISOString(),
		};

		await handleUpdateBoard(updatedBoard);
		closeTaskEditor();
	};

	const handleCreateTasksClick = () => {
		setCreateTasksDescription("");
		setCreateTasksDialogOpen(true);
	};

	const handleCreateTasksSubmit = async () => {
		if (!board || !currentProject || !createTasksDescription.trim()) return;

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
						description: createTasksDescription.trim(),
						count: 5,
						category: "functional",
					},
				}),
			});

			await loadBoard();
			toast.success("Tasks created successfully");
			setCreateTasksDialogOpen(false);
			setCreateTasksDescription("");
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
		setRunBranchInput(generateDefaultBranchName());
		setRunBranchError("");

		// Fetch settings to get default max iterations
		apiFetch("/api/settings")
			.then((res) => res.json())
			.then((data) => {
				const projectMax = data.settings?.automation?.maxIterations || 5;
				setDefaultIterations(projectMax);
				setRunIterationsInput(projectMax);
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
				body: JSON.stringify({ boardId: id, branchName, maxIterations }),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Failed to start AI loop");
			}
			setActiveRun(data.run);
			setRunLog([]);
			setRunDrawerOpen(true);
			setPollingRunId(data.run.runId);
			setBoardRunCount((prev) => prev + 1);
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

	const handleRunDialogChange = (open: boolean) => {
		setStartRunDialogOpen(open);
		if (!open) {
			setRunBranchError("");
		}
	};

	const handleConfirmRunStart = async () => {
		const fallback = generateDefaultBranchName();
		const normalizedBranch = toKebabCase(runBranchInput || fallback);
		if (!normalizedBranch) {
			setRunBranchError("Branch name is required");
			return;
		}
		setRunBranchError("");
		const started = await startRun(normalizedBranch, runIterationsInput);
		if (started) {
			setStartRunDialogOpen(false);
			setRunBranchInput("");
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
	const boardLocked = isRunActive;

	const actions = (
		<div className="flex flex-wrap items-center gap-2">
			<Button variant="outline" onClick={handleNewTask} disabled={boardLocked}>
				<Plus className="w-4 h-4 mr-2" />
				New Task
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" disabled={boardLocked}>
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
				onClick={() => setBoardPropertiesOpen(true)}
				disabled={boardLocked}
			>
				<GearSix className="w-4 h-4 mr-2" />
				Properties
			</Button>
			<Button variant="outline" onClick={() => router.push("/runs")}>
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
				<div className="relative flex flex-1 flex-col rounded-xl">
					{boardLocked && (
						<div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-background/70 px-6 text-center backdrop-blur-sm">
							<p className="text-sm font-semibold text-foreground">
								AI loop running
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Board edits are temporarily disabled until the run completes or
								is canceled.
							</p>
						</div>
					)}
					<div
						className={cn(
							"flex flex-1 flex-col ",
							boardLocked && "pointer-events-none opacity-60",
						)}
					>
						<KanbanBoard
							board={board}
							onUpdateBoard={handleUpdateBoard}
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
			title={board ? board.name : "Board"}
			description={board ? board.goal : "Plan and track sprint progress"}
			actions={actions}
			backLink={{ href: "/", label: "Back to Boards" }}
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
									onClick={() => router.push(`/runs/${activeRun.runId}`)}
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

			<Dialog open={startRunDialogOpen} onOpenChange={handleRunDialogChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Start AI Loop</DialogTitle>
						<DialogDescription>
							Provide the branch name the agent should use. The runner will
							create a git worktree on this branch and only cleans up the
							sandbox after commits are pushed to origin.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="runBranch">Branch name</Label>
						<Input
							id="runBranch"
							value={runBranchInput}
							onChange={(event) => setRunBranchInput(event.target.value)}
							placeholder="run/feature-awesome"
							autoFocus
						/>
						{runBranchError ? (
							<p className="text-sm text-destructive">{runBranchError}</p>
						) : branchPreviewDiffers ? (
							<p className="text-xs text-muted-foreground">
								The new branch will be:{" "}
								<code className="rounded bg-muted px-1 py-0.5 text-[11px]">
									{normalizedBranchPreview}
								</code>
							</p>
						) : null}
					</div>
					<div className="space-y-2 mt-4">
						<Label htmlFor="runIterations">Max Iterations</Label>
						<Input
							id="runIterations"
							type="number"
							min={1}
							max={20}
							value={runIterationsInput}
							onChange={(event) => {
								const val = parseInt(event.target.value, 10);
								setRunIterationsInput(isNaN(val) ? 1 : val);
							}}
						/>
						<p className="text-xs text-muted-foreground">
							Overrides project setting ({defaultIterations}). Max 20
							recommended.
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => handleRunDialogChange(false)}
						>
							Cancel
						</Button>
						<Button onClick={handleConfirmRunStart} disabled={runLoading}>
							{runLoading ? "Starting…" : "Start Run"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={createTasksDialogOpen}
				onOpenChange={setCreateTasksDialogOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Tasks with AI</DialogTitle>
						<DialogDescription>
							Describe a feature or requirement and AI will generate tasks for
							you.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="createTasksDescription">Description</Label>
						<Textarea
							id="createTasksDescription"
							value={createTasksDescription}
							onChange={(e) => setCreateTasksDescription(e.target.value)}
							placeholder="e.g., Add user authentication with login, registration, and password reset"
							rows={4}
							autoFocus
						/>
						<p className="text-xs text-muted-foreground">
							Be specific about what you want to build. The AI will create
							multiple tasks with acceptance criteria.
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setCreateTasksDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreateTasksSubmit}
							disabled={createTasksLoading || !createTasksDescription.trim()}
						>
							{createTasksLoading ? "Creating…" : "Create Tasks"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<BoardPropertiesDialog
				board={board}
				open={boardPropertiesOpen}
				onClose={() => setBoardPropertiesOpen(false)}
				onSave={handleUpdateBoard}
				onDelete={handleDeleteBoard}
			/>
		</AppLayout>
	);
}
