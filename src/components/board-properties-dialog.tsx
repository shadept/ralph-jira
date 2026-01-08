'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { Board } from '@/lib/schemas';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface BoardPropertiesDialogProps {
  board: Board | null;
  open: boolean;
  onClose: () => void;
  onSave: (board: Board) => Promise<void>;
}

export function BoardPropertiesDialog({
  board,
  open,
  onClose,
  onSave,
}: BoardPropertiesDialogProps) {
  const [editedBoard, setEditedBoard] = useState<Board | null>(board);
  const [initialBoard, setInitialBoard] = useState<Board | null>(board);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    startTransition(() => {
      if (board) {
        const cloned: Board = {
          ...board,
          columns: [...board.columns],
          tasks: [...board.tasks],
        };
        setEditedBoard(cloned);
        setInitialBoard(cloned);
      } else {
        setEditedBoard(null);
        setInitialBoard(null);
      }
    });
  }, [board]);

  const isDirty = useMemo(() => {
    if (!editedBoard || !initialBoard) return false;
    return (
      editedBoard.name !== initialBoard.name ||
      editedBoard.goal !== initialBoard.goal ||
      editedBoard.deadline !== initialBoard.deadline ||
      editedBoard.status !== initialBoard.status
    );
  }, [editedBoard, initialBoard]);

  if (!editedBoard) return null;

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
    setSaving(true);
    try {
      await onSave(editedBoard);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const formatDateForInput = (isoString: string) => {
    try {
      return new Date(isoString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleDeadlineChange = (dateString: string) => {
    if (!dateString) return;
    const date = new Date(dateString);
    date.setUTCHours(0, 0, 0, 0);
    setEditedBoard({ ...editedBoard, deadline: date.toISOString() });
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Board Properties</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="boardName">Name</Label>
              <Input
                id="boardName"
                value={editedBoard.name}
                onChange={(e) =>
                  setEditedBoard({ ...editedBoard, name: e.target.value })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="boardGoal">Goal</Label>
              <Textarea
                id="boardGoal"
                value={editedBoard.goal}
                onChange={(e) =>
                  setEditedBoard({ ...editedBoard, goal: e.target.value })
                }
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="boardDeadline">Deadline</Label>
                <Input
                  id="boardDeadline"
                  type="date"
                  value={formatDateForInput(editedBoard.deadline)}
                  onChange={(e) => handleDeadlineChange(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="boardStatus">Status</Label>
                <Select
                  value={editedBoard.status}
                  onValueChange={(value) =>
                    setEditedBoard({
                      ...editedBoard,
                      status: value as Board['status'],
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Columns</Label>
              <div className="mt-1 space-y-1">
                {editedBoard.columns.map((col) => (
                  <div
                    key={col.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm text-muted-foreground"
                  >
                    <span className="font-medium">{col.name}</span>
                    <span className="text-xs">({col.id})</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Column editing is not available yet.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to the board properties. If you discard
              now, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={confirmDiscardChanges}>
              Discard
            </AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              onClick={() => setConfirmDiscardOpen(false)}
            >
              Keep Editing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
