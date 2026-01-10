"use client";

import { startTransition, useEffect, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
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

type FormValues = {
	name: string;
	goal: string;
	deadline: string;
	status: Board["status"];
};

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

function formatDateForInput(isoString: string) {
	try {
		return new Date(isoString).toISOString().split("T")[0];
	} catch {
		return "";
	}
}

function BoardForm({
	board,
	onSave,
	onClose,
	onDelete,
	isCreateMode,
}: {
	board: Board;
	onSave: (board: Board) => Promise<void>;
	onClose: () => void;
	onDelete?: (boardId: string) => Promise<void>;
	isCreateMode: boolean;
}) {
	const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const form = useForm({
		defaultValues: {
			name: board.name,
			goal: board.goal,
			deadline: formatDateForInput(board.deadline),
			status: board.status,
		} as FormValues,
		onSubmit: async ({ value }) => {
			setSaving(true);
			try {
				const date = new Date(value.deadline);
				date.setUTCHours(0, 0, 0, 0);

				const updatedBoard: Board = {
					...board,
					name: value.name,
					goal: value.goal,
					deadline: date.toISOString(),
					status: value.status,
					updatedAt: new Date().toISOString(),
				};
				await onSave(updatedBoard);
				onClose();
			} finally {
				setSaving(false);
			}
		},
	});

	const isDirty = useStore(form.store, (state) => {
		const values = state.values;
		return (
			values.name !== board.name ||
			values.goal !== board.goal ||
			values.deadline !== formatDateForInput(board.deadline) ||
			values.status !== board.status
		);
	});

	const canSave = useStore(form.store, (state) => {
		if (isCreateMode) return Boolean(state.values.name.trim());
		return (
			state.values.name !== board.name ||
			state.values.goal !== board.goal ||
			state.values.deadline !== formatDateForInput(board.deadline) ||
			state.values.status !== board.status
		);
	});

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

	const handleDelete = async () => {
		if (!onDelete) return;
		setDeleting(true);
		try {
			await onDelete(board.id);
			onClose();
		} finally {
			setDeleting(false);
			setConfirmDeleteOpen(false);
		}
	};

	const isProtectedBoard = board.id === "prd" || board.id === "active";

	return (
		<>
			<Dialog
				open={true}
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

					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="space-y-4"
					>
						<form.Field name="name">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Name</Label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										className="mt-1"
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="goal">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Goal</Label>
									<Textarea
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										rows={3}
										className="mt-1"
									/>
								</div>
							)}
						</form.Field>

						<div className="grid grid-cols-2 gap-4">
							<form.Field name="deadline">
								{(field) => (
									<div>
										<Label htmlFor={field.name}>Deadline</Label>
										<Input
											id={field.name}
											type="date"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											className="mt-1"
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="status">
								{(field) => (
									<div>
										<Label htmlFor={field.name}>Status</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as Board["status"])
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
								)}
							</form.Field>
						</div>

						<div>
							<Label>Columns</Label>
							<div className="mt-1 space-y-1">
								{board.columns.map((col) => (
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

						<DialogFooter className="justify-between">
							<div className="flex gap-2">
								{!isCreateMode && onDelete && (
									<Button
										type="button"
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
									type="button"
									variant="outline"
									onClick={requestClose}
									disabled={saving || deleting}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={saving || deleting || !canSave}>
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
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this board?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the board "{board.name}" and all of
							its tasks. This action cannot be undone.
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

export function BoardPropertiesDialog({
	board,
	open,
	onClose,
	onSave,
	onDelete,
	mode = "edit",
}: BoardPropertiesDialogProps) {
	const [editedBoard, setEditedBoard] = useState<Board | null>(null);
	const isCreateMode = mode === "create";

	useEffect(() => {
		startTransition(() => {
			if (isCreateMode && open) {
				setEditedBoard(createDefaultBoard());
			} else if (board && open) {
				setEditedBoard({
					...board,
					columns: [...board.columns],
					tasks: [...board.tasks],
				});
			} else {
				setEditedBoard(null);
			}
		});
	}, [board, isCreateMode, open]);

	if (!open || !editedBoard) return null;

	return (
		<BoardForm
			key={editedBoard.id}
			board={editedBoard}
			onSave={onSave}
			onClose={onClose}
			onDelete={onDelete}
			isCreateMode={isCreateMode}
		/>
	);
}
