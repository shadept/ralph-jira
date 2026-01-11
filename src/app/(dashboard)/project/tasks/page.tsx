"use client";

import {
	CaretDownIcon,
	CaretRightIcon,
	CheckCircleIcon,
	CircleIcon,
	ListChecksIcon,
	PlusIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { useProjectContext } from "@/components/projects/project-provider";
import { TaskEditorDialog } from "@/components/task-editor-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Task } from "@/lib/schemas";

type SprintInfo = {
	id: string;
	name: string;
};

type TaskGroup = {
	sprintId: string | null;
	sprintName: string;
	tasks: Task[];
};

type TasksResponse = {
	groups: TaskGroup[];
	totalCount: number;
	sprints: SprintInfo[];
};

const priorityColors = {
	low: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
	medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
	high: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
	urgent: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const statusColors: Record<string, string> = {
	backlog: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
	todo: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
	in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	review: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
	done: "bg-green-500/10 text-green-700 dark:text-green-400",
};

const statusLabels: Record<string, string> = {
	backlog: "Backlog",
	todo: "To Do",
	in_progress: "In Progress",
	review: "Review",
	done: "Done",
};

function TaskRow({
	task,
	onClick,
	onTogglePasses,
}: {
	task: Task;
	onClick: () => void;
	onTogglePasses: () => void;
}) {
	return (
		<Card
			className="p-3 cursor-pointer hover:shadow-md transition-shadow"
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onTogglePasses();
					}}
					className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform"
				>
					{task.passes ? (
						<CheckCircleIcon className="w-5 h-5 text-green-600" weight="fill" />
					) : (
						<CircleIcon className="w-5 h-5 text-muted-foreground hover:text-green-600" />
					)}
				</button>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<Badge
							variant="outline"
							className={statusColors[task.status] || statusColors.backlog}
						>
							{statusLabels[task.status] || task.status}
						</Badge>
						<Badge variant="outline" className={priorityColors[task.priority]}>
							{task.priority}
						</Badge>
					</div>
					<p className="text-sm font-medium line-clamp-2">{task.description}</p>
					<div className="flex items-center gap-2 flex-wrap mt-2">
						{task.estimate && (
							<Badge variant="secondary" className="text-xs">
								{task.estimate} pts
							</Badge>
						)}
						<Badge variant="secondary" className="text-xs">
							{task.category}
						</Badge>
						{task.tags.slice(0, 2).map((tag) => (
							<Badge key={tag} variant="outline" className="text-xs">
								{tag}
							</Badge>
						))}
					</div>
					{task.failureNotes && (
						<p className="text-xs text-red-600 dark:text-red-400 mt-2 line-clamp-1">
							{task.failureNotes}
						</p>
					)}
				</div>
			</div>
		</Card>
	);
}

function TaskGroupSection({
	group,
	onTaskClick,
	onTogglePasses,
	defaultOpen = true,
}: {
	group: TaskGroup;
	onTaskClick: (task: Task) => void;
	onTogglePasses: (task: Task) => void;
	defaultOpen?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const completedCount = group.tasks.filter((t) => t.passes).length;
	const allDone =
		group.tasks.length > 0 && completedCount === group.tasks.length;

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<div className="flex items-center gap-2 mb-3">
				<CollapsibleTrigger asChild>
					<Button variant="ghost" size="sm" className="p-1 h-auto">
						{isOpen ? (
							<CaretDownIcon className="w-4 h-4" />
						) : (
							<CaretRightIcon className="w-4 h-4" />
						)}
					</Button>
				</CollapsibleTrigger>
				<h3 className="font-semibold text-lg flex-1">
					{group.sprintId ? (
						<Link
							href={`/project/sprints/${group.sprintId}`}
							className="hover:underline"
						>
							{group.sprintName}
						</Link>
					) : (
						<span className="text-muted-foreground">{group.sprintName}</span>
					)}
				</h3>
				<Badge
					variant="secondary"
					className={allDone ? "bg-green-500 text-white" : ""}
				>
					{completedCount} / {group.tasks.length} done
				</Badge>
			</div>
			<CollapsibleContent>
				<div className="space-y-2 pl-6">
					{group.tasks.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4">
							No tasks in this group
						</p>
					) : (
						group.tasks.map((task) => (
							<TaskRow
								key={task.id}
								task={task}
								onClick={() => onTaskClick(task)}
								onTogglePasses={() => onTogglePasses(task)}
							/>
						))
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export default function AllTasksPage() {
	const {
		currentProject,
		loading: projectLoading,
		apiFetch,
	} = useProjectContext();

	const [data, setData] = useState<TasksResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [isNewTask, setIsNewTask] = useState(false);

	const loadTasks = useCallback(async () => {
		if (!currentProject) {
			setData(null);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const res = await apiFetch("/api/tasks");
			const json = await res.json();
			setData(json);
		} catch (error) {
			toast.error("Failed to load tasks");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject]);

	useEffect(() => {
		loadTasks();
	}, [loadTasks]);

	const handleNewTask = () => {
		const newTask: Task = {
			id: `task-${Date.now()}`,
			projectId: currentProject?.id || "default",
			sprintId: null,
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
		setSelectedTask(newTask);
		setIsNewTask(true);
		setIsEditorOpen(true);
	};

	const handleTaskClick = (task: Task) => {
		setSelectedTask(task);
		setIsNewTask(false);
		setIsEditorOpen(true);
	};

	const handleCloseEditor = () => {
		setIsEditorOpen(false);
		setSelectedTask(null);
		setIsNewTask(false);
	};

	const handleSaveTask = async (updatedTask: Task) => {
		try {
			if (isNewTask) {
				// Create new task
				await apiFetch("/api/tasks", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(updatedTask),
				});
				toast.success("Task created");
			} else {
				// Update existing task
				await apiFetch(`/api/tasks/${updatedTask.id}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(updatedTask),
				});
				toast.success("Task updated");
			}
			handleCloseEditor();
			await loadTasks();
		} catch (error) {
			toast.error(
				isNewTask ? "Failed to create task" : "Failed to update task",
			);
			console.error(error);
		}
	};

	const handleDeleteTask = async (taskId: string) => {
		try {
			await apiFetch(`/api/tasks/${taskId}`, {
				method: "DELETE",
			});
			toast.success("Task deleted");
			handleCloseEditor();
			await loadTasks();
		} catch (error) {
			toast.error("Failed to delete task");
			console.error(error);
		}
	};

	const handleTogglePasses = async (task: Task) => {
		try {
			await apiFetch(`/api/tasks/${task.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ passes: !task.passes }),
			});
			await loadTasks();
		} catch (error) {
			toast.error("Failed to update task");
			console.error(error);
		}
	};

	const actions = currentProject ? (
		<Button onClick={handleNewTask}>
			<PlusIcon className="w-4 h-4 mr-2" />
			New Task
		</Button>
	) : null;

	const renderContent = () => {
		if (projectLoading) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading projects...</p>
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
					<p className="text-muted-foreground">Loading tasks...</p>
				</div>
			);
		}

		if (!data || (data.groups.length === 0 && data.totalCount === 0)) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<ListChecksIcon className="w-12 h-12 text-muted-foreground" />
					<p className="text-lg font-semibold">No tasks yet</p>
					<p className="text-sm text-muted-foreground max-w-md">
						Create your first task to get started.
					</p>
					<Button onClick={handleNewTask} className="mt-2">
						<PlusIcon className="w-4 h-4 mr-2" />
						Create Task
					</Button>
				</div>
			);
		}

		return (
			<div className="space-y-6">
				{data.groups.map((group) => (
					<TaskGroupSection
						key={group.sprintId || "no-sprint"}
						group={group}
						onTaskClick={handleTaskClick}
						onTogglePasses={handleTogglePasses}
					/>
				))}
			</div>
		);
	};

	return (
		<>
			<PageHeader
				title="All Tasks"
				description={
					data
						? `${data.totalCount} tasks across ${data.groups.length} groups`
						: "View all tasks in this project"
				}
				backLink={{ href: "/project", label: "Back to Project" }}
				actions={actions}
			/>
			{renderContent()}

			<TaskEditorDialog
				task={selectedTask}
				open={isEditorOpen}
				onClose={handleCloseEditor}
				onSave={handleSaveTask}
				onDelete={isNewTask ? undefined : handleDeleteTask}
			/>
		</>
	);
}
