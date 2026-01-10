"use client";

import { Plus, Sparkle, X } from "@phosphor-icons/react";
import { useForm, useStore } from "@tanstack/react-form";
import { startTransition, useEffect, useState } from "react";
import type { Task } from "@/lib/schemas";
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
import { Badge } from "./ui/badge";
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

interface TaskEditorDialogProps {
	task: Task | null;
	open: boolean;
	onClose: () => void;
	onSave: (task: Task) => Promise<void>;
	onDelete?: (taskId: string) => Promise<void>;
	onAIAction?: (action: string) => Promise<void>;
}

type FormValues = {
	description: string;
	category: string;
	priority: Task["priority"];
	estimate: string;
	acceptanceCriteria: string[];
	tags: string[];
	assigneeId: string;
	failureNotes: string;
};

function TaskForm({
	task,
	onSave,
	onClose,
	onDelete,
	onAIAction,
}: {
	task: Task;
	onSave: (task: Task) => Promise<void>;
	onClose: () => void;
	onDelete?: (taskId: string) => Promise<void>;
	onAIAction?: (action: string) => Promise<void>;
}) {
	const [newStep, setNewStep] = useState("");
	const [newTag, setNewTag] = useState("");
	const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

	const form = useForm({
		defaultValues: {
			description: task.description,
			category: task.category,
			priority: task.priority,
			estimate: task.estimate?.toString() ?? "",
			acceptanceCriteria: [...task.acceptanceCriteria],
			tags: [...task.tags],
			assigneeId: task.assigneeId ?? "",
			failureNotes: task.failureNotes ?? "",
		} as FormValues,
		onSubmit: async ({ value }) => {
			const updatedTask: Task = {
				...task,
				description: value.description,
				category: value.category,
				priority: value.priority,
				estimate: value.estimate ? parseInt(value.estimate, 10) : undefined,
				acceptanceCriteria: value.acceptanceCriteria,
				tags: value.tags,
				assigneeId: value.assigneeId || undefined,
				failureNotes: value.failureNotes || undefined,
			};
			await onSave(updatedTask);
			onClose();
		},
	});

	const isDirty = useStore(form.store, (state) => {
		const v = state.values;
		return (
			v.description !== task.description ||
			v.category !== task.category ||
			v.priority !== task.priority ||
			v.estimate !== (task.estimate?.toString() ?? "") ||
			JSON.stringify(v.acceptanceCriteria) !==
				JSON.stringify(task.acceptanceCriteria) ||
			JSON.stringify(v.tags) !== JSON.stringify(task.tags) ||
			v.assigneeId !== (task.assigneeId ?? "") ||
			v.failureNotes !== (task.failureNotes ?? "")
		);
	});

	const acceptanceCriteria = useStore(
		form.store,
		(state) => state.values.acceptanceCriteria,
	);
	const tags = useStore(form.store, (state) => state.values.tags);
	const failureNotes = useStore(
		form.store,
		(state) => state.values.failureNotes,
	);

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

	const handleDelete = async () => {
		if (!onDelete) return;
		await onDelete(task.id);
		onClose();
	};

	const addStep = () => {
		if (newStep.trim()) {
			const current = form.getFieldValue("acceptanceCriteria");
			form.setFieldValue("acceptanceCriteria", [...current, newStep.trim()]);
			setNewStep("");
		}
	};

	const removeStep = (index: number) => {
		const current = form.getFieldValue("acceptanceCriteria");
		form.setFieldValue(
			"acceptanceCriteria",
			current.filter((_, i) => i !== index),
		);
	};

	const updateStep = (index: number, value: string) => {
		const current = form.getFieldValue("acceptanceCriteria");
		const updated = [...current];
		updated[index] = value;
		form.setFieldValue("acceptanceCriteria", updated);
	};

	const addTag = () => {
		const currentTags = form.getFieldValue("tags");
		if (newTag.trim() && !currentTags.includes(newTag.trim())) {
			form.setFieldValue("tags", [...currentTags, newTag.trim()]);
			setNewTag("");
		}
	};

	const removeTag = (tag: string) => {
		const current = form.getFieldValue("tags");
		form.setFieldValue(
			"tags",
			current.filter((t) => t !== tag),
		);
	};

	const dialogTitle = "Edit Task";
	const canDelete = Boolean(onDelete);

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
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{dialogTitle}</DialogTitle>
					</DialogHeader>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="space-y-4"
					>
						<form.Field name="description">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Description</Label>
									<Textarea
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										rows={2}
										className="mt-1"
									/>
								</div>
							)}
						</form.Field>

						<div className="grid grid-cols-3 gap-4">
							<form.Field name="category">
								{(field) => (
									<div>
										<Label htmlFor={field.name}>Category</Label>
										<Input
											id={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											className="mt-1"
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="priority">
								{(field) => (
									<div>
										<Label htmlFor={field.name}>Priority</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as Task["priority"])
											}
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
								)}
							</form.Field>

							<form.Field name="estimate">
								{(field) => (
									<div>
										<Label htmlFor={field.name}>Estimate (points)</Label>
										<Input
											id={field.name}
											type="number"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											className="mt-1"
										/>
									</div>
								)}
							</form.Field>
						</div>

						<div>
							<div className="flex items-center justify-between mb-2">
								<Label>Acceptance Criteria</Label>
								{onAIAction && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => onAIAction("improve-acceptance-criteria")}
									>
										<Sparkle className="w-4 h-4 mr-1" />
										AI Improve
									</Button>
								)}
							</div>
							<div className="space-y-2">
								{acceptanceCriteria.map((step, idx) => (
									<div
										key={`${task.id}-step-${idx}`}
										className="flex items-start gap-2"
									>
										<span className="text-sm text-muted-foreground mt-2 w-6">
											{idx + 1}.
										</span>
										<Input
											value={step}
											onChange={(e) => updateStep(idx, e.target.value)}
											className="flex-1"
										/>
										<Button
											type="button"
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
										placeholder="Add acceptance criterion..."
										value={newStep}
										onChange={(e) => setNewStep(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												addStep();
											}
										}}
									/>
									<Button type="button" onClick={addStep}>
										<Plus className="w-4 h-4" />
									</Button>
								</div>
							</div>
						</div>

						<div>
							<Label>Tags</Label>
							<div className="flex flex-wrap gap-2 mt-2 mb-2">
								{tags.map((tag) => (
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
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addTag();
										}
									}}
								/>
								<Button type="button" onClick={addTag}>
									<Plus className="w-4 h-4" />
								</Button>
							</div>
						</div>

						<form.Field name="assigneeId">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Assignee</Label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Optional"
										className="mt-1"
									/>
								</div>
							)}
						</form.Field>

						{failureNotes && (
							<form.Field name="failureNotes">
								{(field) => (
									<div>
										<Label htmlFor={field.name}>Failure Notes</Label>
										<Textarea
											id={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											className="mt-1 text-red-600"
											rows={2}
										/>
									</div>
								)}
							</form.Field>
						)}

						<DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
							<div className="w-full sm:w-auto">
								{canDelete && (
									<Button
										type="button"
										variant="destructive"
										onClick={handleDelete}
									>
										Delete Task
									</Button>
								)}
							</div>
							<div className="flex gap-2 sm:justify-end w-full sm:w-auto">
								<Button type="button" variant="outline" onClick={requestClose}>
									Cancel
								</Button>
								<Button type="submit">Save Task</Button>
							</div>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={confirmDiscardOpen}
				onOpenChange={setConfirmDiscardOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard changes?</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved edits to this task. If you discard now, your
							changes will be lost.
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

export function TaskEditorDialog({
	task,
	open,
	onClose,
	onSave,
	onDelete,
	onAIAction,
}: TaskEditorDialogProps) {
	const [editedTask, setEditedTask] = useState<Task | null>(null);

	useEffect(() => {
		startTransition(() => {
			if (task && open) {
				setEditedTask({
					...task,
					acceptanceCriteria: [...task.acceptanceCriteria],
					tags: [...task.tags],
					filesTouched: [...task.filesTouched],
				});
			} else {
				setEditedTask(null);
			}
		});
	}, [task, open]);

	if (!open || !editedTask) return null;

	return (
		<TaskForm
			key={editedTask.id}
			task={editedTask}
			onSave={onSave}
			onClose={onClose}
			onDelete={onDelete}
			onAIAction={onAIAction}
		/>
	);
}
