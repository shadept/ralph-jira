'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Board, Task } from '@/lib/schemas';
import { KanbanColumn } from './kanban-column';
import { TaskCard } from './task-card';

interface KanbanBoardProps {
  board: Board;
  onUpdateBoard: (board: Board) => Promise<void>;
  onTaskClick: (task: Task) => void;
}

export function KanbanBoard({ board, onUpdateBoard, onTaskClick }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = board.tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const resolveStatusFromTarget = (targetId: string): Task['status'] | undefined => {
    if (board.columns.some(column => column.id === targetId)) {
      return targetId;
    }

    const targetTask = board.tasks.find(t => t.id === targetId);
    return targetTask?.status;
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

    const task = board.tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) {
      setActiveTask(null);
      return;
    }

    const nextTasks = board.tasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          }
        : t
    );

    const updatedBoard = {
      ...board,
      tasks: nextTasks,
      updatedAt: new Date().toISOString(),
    };

    setActiveTask(null);
    await onUpdateBoard(updatedBoard);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mx-auto flex flex-1 gap-4 pb-4">
        {board.columns
          .sort((a, b) => a.order - b.order)
          .map(column => {
            const columnTasks = board.tasks.filter(t => t.status === column.id);

            return (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={columnTasks}
                onTaskClick={onTaskClick}
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
