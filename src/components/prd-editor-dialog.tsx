"use client";

import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { useForm, useStore } from "@tanstack/react-form";
import { startTransition, useEffect, useState } from "react";
import type { Prd } from "@/lib/schemas";
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

interface PrdEditorDialogProps {
	prd: Prd | null;
	open: boolean;
	onClose: () => void;
	onSave: (prd: Prd) => Promise<void>;
	onDelete?: (prdId: string) => Promise<void>;
	mode: "create" | "edit";
}

type FormValues = {
	title: string;
	content: string;
	status: Prd["status"];
	priority: Prd["priority"];
	tags: string[];
};

function PrdForm({
	prd,
	onSave,
	onClose,
	onDelete,
	mode,
}: {
	prd: Prd;
	onSave: (prd: Prd) => Promise<void>;
	onClose: () => void;
	onDelete?: (prdId: string) => Promise<void>;
	mode: "create" | "edit";
}) {
	const [newTag, setNewTag] = useState("");
	const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const form = useForm({
		defaultValues: {
			title: prd.title,
			content: prd.content ?? "",
			status: prd.status,
			priority: prd.priority,
			tags: [...prd.tags],
		} as FormValues,
		onSubmit: async ({ value }) => {
			setSaving(true);
			try {
				const updatedPrd: Prd = {
					...prd,
					title: value.title,
					content: value.content,
					status: value.status,
					priority: value.priority,
					tags: value.tags,
				};
				await onSave(updatedPrd);
				onClose();
			} finally {
				setSaving(false);
			}
		},
	});

	const isDirty = useStore(form.store, (state) => {
		const v = state.values;
		return (
			v.title !== prd.title ||
			v.content !== (prd.content ?? "") ||
			v.status !== prd.status ||
			v.priority !== prd.priority ||
			JSON.stringify(v.tags) !== JSON.stringify(prd.tags)
		);
	});

	const tags = useStore(form.store, (state) => state.values.tags);
	const title = useStore(form.store, (state) => state.values.title);

	const canSave = title.trim().length > 0;

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
		setDeleting(true);
		try {
			await onDelete(prd.id);
			onClose();
		} finally {
			setDeleting(false);
			setConfirmDeleteOpen(false);
		}
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

	const dialogTitle = mode === "create" ? "Create PRD" : "Edit PRD";
	const canDelete = mode === "edit" && Boolean(onDelete);

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
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
						{/* Two-column layout */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							{/* Left Column: Title and Content (2/3 width) */}
							<div className="md:col-span-2 space-y-4">
								<form.Field name="title">
									{(field) => (
										<div>
											<Label htmlFor={field.name}>Title *</Label>
											<Input
												id={field.name}
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Product Requirements Document title"
												className="mt-1"
											/>
										</div>
									)}
								</form.Field>

								<form.Field name="content">
									{(field) => (
										<div>
											<Label htmlFor={field.name}>Content</Label>
											<Textarea
												id={field.name}
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Describe the requirements, goals, user stories, and specifications..."
												rows={16}
												className="mt-1 font-mono text-sm"
											/>
											<p className="text-xs text-muted-foreground mt-1">
												Supports markdown formatting for structured content
											</p>
										</div>
									)}
								</form.Field>
							</div>

							{/* Right Column: Metadata fields (1/3 width) */}
							<div className="space-y-4">
								<form.Field name="status">
									{(field) => (
										<div>
											<Label htmlFor={field.name}>Status</Label>
											<Select
												value={field.state.value}
												onValueChange={(value) =>
													field.handleChange(value as Prd["status"])
												}
											>
												<SelectTrigger className="mt-1">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="draft">Draft</SelectItem>
													<SelectItem value="review">In Review</SelectItem>
													<SelectItem value="approved">Approved</SelectItem>
													<SelectItem value="archived">Archived</SelectItem>
												</SelectContent>
											</Select>
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
													field.handleChange(value as Prd["priority"])
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

								<div>
									<Label>Tags</Label>
									<div className="flex flex-wrap gap-2 mt-2 mb-2 min-h-[32px]">
										{tags.map((tag) => (
											<Badge key={tag} variant="secondary">
												{tag}
												<button
													type="button"
													onClick={() => removeTag(tag)}
													className="ml-1 hover:text-destructive"
												>
													<XIcon className="w-3 h-3" />
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
										<Button type="button" size="sm" onClick={addTag}>
											<PlusIcon className="w-4 h-4" />
										</Button>
									</div>
								</div>

								{mode === "edit" && prd.createdAt && (
									<div className="pt-4 border-t text-sm text-muted-foreground space-y-1">
										<p>
											Created: {new Date(prd.createdAt).toLocaleDateString()}
										</p>
										{prd.updatedAt && (
											<p>
												Updated: {new Date(prd.updatedAt).toLocaleDateString()}
											</p>
										)}
									</div>
								)}
							</div>
						</div>

						<DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
							<div className="w-full sm:w-auto">
								{canDelete && (
									<Button
										type="button"
										variant="destructive"
										onClick={() => setConfirmDeleteOpen(true)}
										disabled={deleting}
									>
										Delete PRD
									</Button>
								)}
							</div>
							<div className="flex gap-2 sm:justify-end w-full sm:w-auto">
								<Button
									type="button"
									variant="outline"
									onClick={requestClose}
									disabled={saving}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={saving || !canSave}>
									{saving
										? "Saving..."
										: mode === "create"
											? "Create PRD"
											: "Save PRD"}
								</Button>
							</div>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Discard changes confirmation */}
			<AlertDialog
				open={confirmDiscardOpen}
				onOpenChange={setConfirmDiscardOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard changes?</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved edits to this PRD. If you discard now, your
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

			{/* Delete confirmation */}
			<AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this PRD?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{prd.title}". This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleDelete}
							disabled={deleting}
						>
							{deleting ? "Deleting..." : "Delete PRD"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function PrdEditorDialog({
	prd,
	open,
	onClose,
	onSave,
	onDelete,
	mode,
}: PrdEditorDialogProps) {
	const [editedPrd, setEditedPrd] = useState<Prd | null>(null);

	useEffect(() => {
		startTransition(() => {
			if (prd && open) {
				setEditedPrd({
					...prd,
					tags: [...prd.tags],
				});
			} else {
				setEditedPrd(null);
			}
		});
	}, [prd, open]);

	if (!open || !editedPrd) return null;

	return (
		<PrdForm
			key={editedPrd.id}
			prd={editedPrd}
			onSave={onSave}
			onClose={onClose}
			onDelete={onDelete}
			mode={mode}
		/>
	);
}
