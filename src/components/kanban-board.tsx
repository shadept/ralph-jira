"use client";

import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import type { Sprint, Task } from "@/lib/schemas";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";

interface KanbanBoardProps {
	sprint: Sprint;
	onUpdateSprint: (sprint: Sprint) => Promise<void>;
	onTaskClick: (task: Task) => void;
	onTogglePasses?: (taskId: string) => void;
}

export function KanbanBoard({
	sprint,
	onUpdateSprint,
	onTaskClick,
	onTogglePasses,
}: KanbanBoardProps) {
	const [activeTask, setActiveTask] = useState<Task | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
	);

	const tasks = sprint.tasks || [];
	const columns = sprint.columns || [];

	const handleDragStart = (event: DragStartEvent) => {
		const task = tasks.find((t) => t.id === event.active.id);
		setActiveTask(task || null);
	};

	const resolveStatusFromTarget = (
		targetId: string,
	): Task["status"] | undefined => {
		if (columns.some((column) => column.id === targetId)) {
			return targetId as Task["status"];
		}

		const targetTask = tasks.find((t) => t.id === targetId);
		return targetTask?.status;
	};

	const handleTogglePasses = async (taskId: string) => {
		if (onTogglePasses) {
			onTogglePasses(taskId);
			return;
		}

		const task = tasks.find((t) => t.id === taskId);
		if (!task) return;

		const nextTasks = tasks.map((t) =>
			t.id === taskId
				? {
						...t,
						passes: !t.passes,
						updatedAt: new Date().toISOString(),
					}
				: t,
		);

		const updatedSprint = {
			...sprint,
			tasks: nextTasks,
			updatedAt: new Date().toISOString(),
		};

		await onUpdateSprint(updatedSprint);
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		if (!over) {
			setActiveTask(null);
			return;
		}

		const taskId = active.id as string;
		const newStatus = resolveStatusFromTarget(over.id as string);

		if (!newStatus) {
			setActiveTask(null);
			return;
		}

		const task = tasks.find((t) => t.id === taskId);
		if (!task || task.status === newStatus) {
			setActiveTask(null);
			return;
		}

		const nextTasks = tasks.map((t) =>
			t.id === taskId
				? {
						...t,
						status: newStatus,
						updatedAt: new Date().toISOString(),
					}
				: t,
		);

		const updatedSprint = {
			...sprint,
			tasks: nextTasks,
			updatedAt: new Date().toISOString(),
		};

		setActiveTask(null);
		await onUpdateSprint(updatedSprint);
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={pointerWithin}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
		>
			<div className="mx-auto max-w-full flex flex-1 gap-4 pb-4 overflow-x-auto">
				{columns
					.sort((a, b) => a.order - b.order)
					.map((column) => {
						const columnTasks = tasks.filter((t) => t.status === column.id);

						return (
							<KanbanColumn
								key={column.id}
								column={column}
								tasks={columnTasks}
								onTaskClick={onTaskClick}
								onTogglePasses={handleTogglePasses}
							/>
						);
					})}
			</div>

			<DragOverlay dropAnimation={null}>
				{activeTask ? (
					<TaskCard task={activeTask} onClick={() => {}} isDragging />
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
