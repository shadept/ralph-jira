'use client';

import { useDroppable, useDndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Column, Task } from '@/lib/schemas';
import { TaskCard } from './task-card';
import { Badge } from './ui/badge';

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function KanbanColumn({ column, tasks, onTaskClick }: KanbanColumnProps) {
  const { over } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const columnIsTargeted = Boolean(
    over && (over.id === column.id || tasks.some(task => task.id === over.id))
  );

  const isHighlighted = isOver || columnIsTargeted;

  return (
    <div className="flex flex-col min-w-[300px] max-w-[350px] flex-shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-sm uppercase tracking-wide">
          {column.name}
        </h3>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-2 rounded-lg border-2 border-dashed min-h-[200px] flex-1 transition-colors ${
          isHighlighted ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50'
        }`}
      >
        <SortableContext
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
