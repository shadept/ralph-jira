"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { Board } from "@/lib/schemas";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "./ui/dialog";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";

export type BoardDialogMode = "create" | "edit";

interface BoardPropertiesDialogProps {
	board: Board | null;
	open: boolean;
	onClose: () => void;
	onSave: (board: Board) => Promise<void>;
	onDelete?: (boardId: string) => Promise<void>;
	mode?: BoardDialogMode;
}

const DEFAULT_COLUMNS = [
	{ id: "backlog", name: "Backlog", order: 0 },
	{ id: "todo", name: "To Do", order: 1 },
	{ id: "in_progress", name: "In Progress", order: 2 },
	{ id: "review", name: "Review", order: 3 },
	{ id: "done", name: "Done", order: 4 },
];

function createDefaultBoard(): Board {
	const now = new Date().toISOString();
	return {
		id: `board-${Date.now()}`,
		name: "New Sprint",
		goal: "",
		deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
		status: "planned",
		columns: DEFAULT_COLUMNS,
		tasks: [],
		createdAt: now,
		updatedAt: now,
	};
}

export function BoardPropertiesDialog({
	board,
	open,
	onClose,
	onSave,
	onDelete,
	mode = "edit",
}: BoardPropertiesDialogProps) {
	const [editedBoard, setEditedBoard] = useState<Board | null>(board);
	const [initialBoard, setInitialBoard] = useState<Board | null>(board);
	const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const isCreateMode = mode === "create";

	useEffect(() => {
		startTransition(() => {
			if (isCreateMode && open) {
				const newBoard = createDefaultBoard();
				setEditedBoard(newBoard);
				setInitialBoard(newBoard);
			} else if (board) {
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
	}, [board, isCreateMode, open]);

	const isDirty = useMemo(() => {
		if (!editedBoard || !initialBoard) return false;
		return (
			editedBoard.name !== initialBoard.name ||
			editedBoard.goal !== initialBoard.goal ||
			editedBoard.deadline !== initialBoard.deadline ||
			editedBoard.status !== initialBoard.status
		);
	}, [editedBoard, initialBoard]);

	const canSave = isCreateMode ? Boolean(editedBoard?.name.trim()) : isDirty;

	if (!editedBoard) return null;

	const requestClose = () => {
		if (isDirty && !isCreateMode) {
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

	const handleDelete = async () => {
		if (!onDelete || !editedBoard) return;
		setDeleting(true);
		try {
			await onDelete(editedBoard.id);
			onClose();
		} finally {
			setDeleting(false);
			setConfirmDeleteOpen(false);
		}
	};

	const isProtectedBoard =
		editedBoard.id === "prd" || editedBoard.id === "active";

	const formatDateForInput = (isoString: string) => {
		try {
			return new Date(isoString).toISOString().split("T")[0];
		} catch {
			return "";
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
						<DialogTitle>
							{isCreateMode ? "Create Board" : "Board Properties"}
						</DialogTitle>
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
											status: value as Board["status"],
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

					<DialogFooter className="justify-between">
						<div className="flex gap-2">
							{!isCreateMode && onDelete && (
								<Button
									variant="destructive"
									onClick={() => setConfirmDeleteOpen(true)}
									disabled={saving || deleting || isProtectedBoard}
								>
									Delete Board
								</Button>
							)}
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								onClick={requestClose}
								disabled={saving || deleting}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSave}
								disabled={saving || deleting || !canSave}
							>
								{saving
									? isCreateMode
										? "Creating..."
										: "Saving..."
									: isCreateMode
										? "Create Board"
										: "Save Changes"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this board?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the board "{editedBoard.name}" and
							all of its tasks. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={(e) => {
								e.preventDefault();
								handleDelete();
							}}
							disabled={deleting}
						>
							{deleting ? "Deleting..." : "Delete Board"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={confirmDiscardOpen}
				onOpenChange={setConfirmDiscardOpen}
			>
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
