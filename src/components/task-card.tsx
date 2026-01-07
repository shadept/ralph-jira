'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/lib/schemas';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle, Circle } from '@phosphor-icons/react';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
}

export function TaskCard({ task, onClick, isDragging = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const priorityColors = {
    low: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    high: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    urgent: 'bg-red-500/10 text-red-700 dark:text-red-400',
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg rotate-2' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2 mb-2">
        {task.passes ? (
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" weight="fill" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2">{task.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <Badge variant="outline" className={priorityColors[task.priority]}>
          {task.priority}
        </Badge>

        {task.estimate && (
          <Badge variant="secondary" className="text-xs">
            {task.estimate} pts
          </Badge>
        )}

        <Badge variant="secondary" className="text-xs">
          {task.category}
        </Badge>

        {task.tags.slice(0, 2).map(tag => (
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
    </Card>
  );
}
