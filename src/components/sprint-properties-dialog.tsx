"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { startTransition, useEffect, useState } from "react";
import type { Sprint } from "@/lib/schemas";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

export type SprintDialogMode = "create" | "edit";

interface SprintPropertiesDialogProps {
	sprint: Sprint | null;
	open: boolean;
	onClose: () => void;
	onSave: (sprint: Sprint) => Promise<void>;
	onDelete?: (sprintId: string) => Promise<void>;
	mode?: SprintDialogMode;
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
	status: Sprint["status"];
};

function createDefaultSprint(): Sprint {
	const now = new Date().toISOString();
	return {
		id: `sprint-${Date.now()}`,
		name: "New Sprint",
		goal: "",
		deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
		status: "planning",
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

function SprintForm({
	sprint,
	onSave,
	onClose,
	onDelete,
	isCreateMode,
}: {
	sprint: Sprint;
	onSave: (sprint: Sprint) => Promise<void>;
	onClose: () => void;
	onDelete?: (sprintId: string) => Promise<void>;
	isCreateMode: boolean;
}) {
	const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const form = useForm({
		defaultValues: {
			name: sprint.name,
			goal: sprint.goal || "",
			deadline: formatDateForInput(sprint.deadline),
			status: sprint.status,
		} as FormValues,
		onSubmit: async ({ value }) => {
			setSaving(true);
			try {
				const date = new Date(value.deadline);
				date.setUTCHours(0, 0, 0, 0);

				const updatedSprint: Sprint = {
					...sprint,
					name: value.name,
					goal: value.goal,
					deadline: date.toISOString(),
					status: value.status,
					updatedAt: new Date().toISOString(),
				};
				await onSave(updatedSprint);
				onClose();
			} finally {
				setSaving(false);
			}
		},
	});

	const isDirty = useStore(form.store, (state) => {
		const values = state.values;
		return (
			values.name !== sprint.name ||
			values.goal !== (sprint.goal || "") ||
			values.deadline !== formatDateForInput(sprint.deadline) ||
			values.status !== sprint.status
		);
	});

	const canSave = useStore(form.store, (state) => {
		if (isCreateMode) return Boolean(state.values.name.trim());
		return (
			state.values.name !== sprint.name ||
			state.values.goal !== (sprint.goal || "") ||
			state.values.deadline !== formatDateForInput(sprint.deadline) ||
			state.values.status !== sprint.status
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
			await onDelete(sprint.id);
			onClose();
		} finally {
			setDeleting(false);
			setConfirmDeleteOpen(false);
		}
	};

	const isProtectedSprint = sprint.id === "prd" || sprint.id === "active";

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
							{isCreateMode ? "Create Sprint" : "Sprint Properties"}
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
												field.handleChange(value as Sprint["status"])
											}
										>
											<SelectTrigger className="mt-1">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="planning">Planning</SelectItem>
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
								{(sprint.columns || DEFAULT_COLUMNS).map((col) => (
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
										disabled={saving || deleting || isProtectedSprint}
									>
										Delete Sprint
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
											? "Create Sprint"
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
						<AlertDialogTitle>Delete this sprint?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the sprint "{sprint.name}" and all of
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
							{deleting ? "Deleting..." : "Delete Sprint"}
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
							You have unsaved changes to the sprint properties. If you discard
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

export function SprintPropertiesDialog({
	sprint,
	open,
	onClose,
	onSave,
	onDelete,
	mode = "edit",
}: SprintPropertiesDialogProps) {
	const [editedSprint, setEditedSprint] = useState<Sprint | null>(null);
	const isCreateMode = mode === "create";

	useEffect(() => {
		startTransition(() => {
			if (isCreateMode && open) {
				setEditedSprint(createDefaultSprint());
			} else if (sprint && open) {
				setEditedSprint({
					...sprint,
					columns: sprint.columns ? [...sprint.columns] : DEFAULT_COLUMNS,
					tasks: sprint.tasks ? [...sprint.tasks] : [],
				});
			} else {
				setEditedSprint(null);
			}
		});
	}, [sprint, isCreateMode, open]);

	if (!open || !editedSprint) return null;

	return (
		<SprintForm
			key={editedSprint.id}
			sprint={editedSprint}
			onSave={onSave}
			onClose={onClose}
			onDelete={onDelete}
			isCreateMode={isCreateMode}
		/>
	);
}
