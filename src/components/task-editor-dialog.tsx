'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { Task } from '@/lib/schemas';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, X, Sparkle } from '@phosphor-icons/react';

interface TaskEditorDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSave: (task: Task) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onAIAction?: (action: string) => Promise<void>;
}

export function TaskEditorDialog({ task, open, onClose, onSave, onDelete, onAIAction }: TaskEditorDialogProps) {
  const [editedTask, setEditedTask] = useState<Task | null>(task);
  const [initialTask, setInitialTask] = useState<Task | null>(task);
  const [newStep, setNewStep] = useState('');
  const [newTag, setNewTag] = useState('');
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  useEffect(() => {
    startTransition(() => {
      if (task) {
        const clonedTask: Task = {
          ...task,
          steps: [...task.steps],
          tags: [...task.tags],
          filesTouched: [...task.filesTouched],
        };
        setEditedTask(clonedTask);
        setInitialTask(clonedTask);
      } else {
        setEditedTask(null);
        setInitialTask(null);
      }
      setNewStep('');
      setNewTag('');
    });
  }, [task]);

  const isDirty = useMemo(() => {
    if (!editedTask || !initialTask) return false;
    return JSON.stringify(editedTask) !== JSON.stringify(initialTask);
  }, [editedTask, initialTask]);

  if (!editedTask) return null;

  const requestClose = () => {
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  const confirmDiscardChanges = () => {
    setConfirmDiscardOpen(false);
    onClose();
  };

  const handleSave = async () => {
    await onSave(editedTask);
    onClose();
  };

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    await onDelete(task.id);
    onClose();
  };

  const dialogTitle = task ? 'Edit Task' : 'New Task';
  const canDelete = Boolean(task && onDelete);

  const addStep = () => {
    if (newStep.trim()) {
      setEditedTask({
        ...editedTask,
        steps: [...editedTask.steps, newStep.trim()],
      });
      setNewStep('');
    }
  };

  const removeStep = (index: number) => {
    setEditedTask({
      ...editedTask,
      steps: editedTask.steps.filter((_, i) => i !== index),
    });
  };

  const addTag = () => {
    if (newTag.trim() && !editedTask.tags.includes(newTag.trim())) {
      setEditedTask({
        ...editedTask,
        tags: [...editedTask.tags, newTag.trim()],
      });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setEditedTask({
      ...editedTask,
      tags: editedTask.tags.filter(t => t !== tag),
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            requestClose();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={editedTask.description}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={editedTask.category}
                onChange={(e) => setEditedTask({ ...editedTask, category: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={editedTask.priority}
                onValueChange={(value) => setEditedTask({ ...editedTask, priority: value as Task['priority'] })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="estimate">Estimate (points)</Label>
              <Input
                id="estimate"
                type="number"
                value={editedTask.estimate || ''}
                onChange={(e) => setEditedTask({ ...editedTask, estimate: e.target.value ? parseInt(e.target.value) : undefined })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Acceptance Steps</Label>
              {onAIAction && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAIAction('improve-steps')}
                >
                  <Sparkle className="w-4 h-4 mr-1" />
                  AI Improve
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {editedTask.steps.map((step, idx) => (
                <div key={`${editedTask.id}-${step}`} className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground mt-2 w-6">{idx + 1}.</span>
                  <Input
                    value={step}
                    onChange={(e) => {
                      const newSteps = [...editedTask.steps];
                      newSteps[idx] = e.target.value;
                      setEditedTask({ ...editedTask, steps: newSteps });
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(idx)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Add acceptance step..."
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addStep()}
                />
                <Button onClick={addStep}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mt-2 mb-2">
              {editedTask.tags.map(tag => (
                <Badge key={tag} variant="secondary">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
              />
              <Button onClick={addTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="assignee">Assignee</Label>
            <Input
              id="assignee"
              value={editedTask.assignee || ''}
              onChange={(e) => setEditedTask({ ...editedTask, assignee: e.target.value || undefined })}
              placeholder="Optional"
              className="mt-1"
            />
          </div>

          {editedTask.failureNotes && (
            <div>
              <Label>Failure Notes</Label>
              <Textarea
                value={editedTask.failureNotes}
                onChange={(e) => setEditedTask({ ...editedTask, failureNotes: e.target.value })}
                className="mt-1 text-red-600"
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="w-full sm:w-auto">
            {canDelete && (
              <Button variant="destructive" onClick={handleDelete}>
                Delete Task
              </Button>
            )}
          </div>
          <div className="flex gap-2 sm:justify-end w-full sm:w-auto">
            <Button variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Task
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to this task. If you discard now, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={confirmDiscardChanges}>
              Discard
            </AlertDialogCancel>
            <AlertDialogAction autoFocus onClick={() => setConfirmDiscardOpen(false)}>
              Keep Editing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
