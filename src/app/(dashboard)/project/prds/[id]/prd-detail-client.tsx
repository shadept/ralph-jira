"use client";

import {
	ArchiveIcon,
	ArrowsClockwiseIcon,
	CheckIcon,
	PencilSimpleIcon,
	PlusIcon,
	SparkleIcon,
	SpinnerIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { format, formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MarkdownEditorLoading } from "@/components/markdown-editor";
import { PageHeader } from "@/components/layout/page-header";
import { useProjectContext } from "@/components/projects/project-provider";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Prd } from "@/lib/schemas";

// Dynamic import of MDXEditor to avoid SSR issues
const MarkdownEditor = dynamic(
	() =>
		import("@/components/markdown-editor").then((mod) => mod.MarkdownEditor),
	{
		ssr: false,
		loading: () => <MarkdownEditorLoading />,
	},
);

const statusColors: Record<string, string> = {
	draft: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
	review: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
	approved: "bg-green-500/10 text-green-700 dark:text-green-400",
	archived: "bg-gray-500/10 text-gray-500 dark:text-gray-400",
};

const statusLabels: Record<string, string> = {
	draft: "Draft",
	review: "In Review",
	approved: "Approved",
	archived: "Archived",
};

const priorityColors: Record<string, string> = {
	low: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
	medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
	high: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
	urgent: "bg-red-500/10 text-red-700 dark:text-red-400",
};

function RefinePrdDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (focusAreas?: string[]) => Promise<void>;
	loading: boolean;
}) {
	const form = useForm({
		defaultValues: {
			focusAreas: "",
		},
		onSubmit: async ({ value }) => {
			const areas = value.focusAreas
				.split("\n")
				.map((a) => a.trim())
				.filter(Boolean);
			await onSubmit(areas.length > 0 ? areas : undefined);
		},
	});

	useEffect(() => {
		if (open) {
			form.reset();
		}
	}, [open, form]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Refine PRD with AI</DialogTitle>
					<DialogDescription>
						AI will review and improve your PRD for clarity, completeness, and
						actionability.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Field name="focusAreas">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Focus Areas (optional)</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="e.g., Add more edge cases&#10;Improve acceptance criteria&#10;Clarify technical requirements"
									rows={3}
									disabled={loading}
								/>
								<p className="text-xs text-muted-foreground">
									Enter specific areas to focus on (one per line), or leave
									empty for general improvement.
								</p>
							</div>
						)}
					</form.Field>

					<DialogFooter className="mt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? (
								<>
									Refining
									<SpinnerIcon className="ml-2 h-4 w-4 animate-spin" />
								</>
							) : (
								<>
									<SparkleIcon className="mr-2 h-4 w-4" />
									Refine PRD
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function ConvertToSprintDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
	prdTitle,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: {
		name: string;
		goal: string;
		deadline: string;
	}) => Promise<void>;
	loading: boolean;
	prdTitle: string;
}) {
	const form = useForm({
		defaultValues: {
			name: `Sprint: ${prdTitle}`,
			goal: "",
			deadline: format(
				new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
				"yyyy-MM-dd",
			),
		},
		onSubmit: async ({ value }) => {
			if (!value.name.trim() || !value.deadline) return;
			await onSubmit({
				name: value.name.trim(),
				goal: value.goal.trim(),
				deadline: value.deadline,
			});
		},
	});

	useEffect(() => {
		if (open) {
			form.setFieldValue("name", `Sprint: ${prdTitle}`);
			form.setFieldValue("goal", "");
			form.setFieldValue(
				"deadline",
				format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
			);
		}
	}, [open, prdTitle, form]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Convert PRD to Sprint</DialogTitle>
					<DialogDescription>
						Create a new sprint from this PRD. The sprint will be linked to the
						source PRD.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<div className="space-y-4">
						<form.Field name="name">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Sprint Name *</Label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="e.g., Sprint 1: Authentication"
										autoFocus
										disabled={loading}
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="goal">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Sprint Goal (optional)</Label>
									<Textarea
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="What do you want to achieve in this sprint?"
										rows={2}
										disabled={loading}
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="deadline">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Deadline *</Label>
									<Input
										id={field.name}
										type="date"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										disabled={loading}
									/>
								</div>
							)}
						</form.Field>
					</div>

					<DialogFooter className="mt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<form.Subscribe
							selector={(state) => ({
								name: state.values.name,
								deadline: state.values.deadline,
							})}
						>
							{({ name, deadline }) => (
								<Button
									type="submit"
									disabled={loading || !name.trim() || !deadline}
								>
									{loading ? (
										<>
											Creating
											<SpinnerIcon className="ml-2 h-4 w-4 animate-spin" />
										</>
									) : (
										<>
											<ArrowsClockwiseIcon className="mr-2 h-4 w-4" />
											Create Sprint
										</>
									)}
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

interface PrdDetailClientProps {
	initialPrd: Prd;
	prdId: string;
}

export function PrdDetailClient({ initialPrd, prdId }: PrdDetailClientProps) {
	const router = useRouter();
	const { apiFetch } = useProjectContext();

	const [prd, setPrd] = useState<Prd>(initialPrd);

	// Delete confirmation state
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// Archive confirmation state
	const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
	const [archiving, setArchiving] = useState(false);

	// AI action states
	const [refineDialogOpen, setRefineDialogOpen] = useState(false);
	const [aiLoading, setAiLoading] = useState(false);

	// Convert to Sprint states
	const [convertDialogOpen, setConvertDialogOpen] = useState(false);
	const [convertLoading, setConvertLoading] = useState(false);

	// Content editing & auto-save states
	const [editorContent, setEditorContent] = useState<string>(
		initialPrd.content ?? "",
	);
	const [isSaving, setIsSaving] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
		initialPrd.updatedAt ? new Date(initialPrd.updatedAt) : null,
	);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastSavedContentRef = useRef<string>(initialPrd.content ?? "");

	// Inline editing states for sidebar fields
	const [newTag, setNewTag] = useState("");
	const [updatingField, setUpdatingField] = useState<string | null>(null);

	// Title editing state
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [editedTitle, setEditedTitle] = useState(initialPrd.title);
	const titleInputRef = useRef<HTMLInputElement>(null);

	const loadPrd = useCallback(async () => {
		try {
			const res = await apiFetch(`/api/prds/${prdId}`);
			if (!res.ok) {
				throw new Error("Failed to load PRD");
			}
			const data = await res.json();
			setPrd(data.prd);
		} catch (error) {
			toast.error("Failed to load PRD");
			console.error(error);
		}
	}, [apiFetch, prdId]);

	// Handler to update a single field inline
	const handleInlineUpdate = useCallback(
		async (field: string, value: unknown) => {
			setUpdatingField(field);
			try {
				const res = await apiFetch(`/api/prds/${prdId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ [field]: value }),
				});
				if (!res.ok) throw new Error(`Failed to update ${field}`);
				await loadPrd();
			} catch (error) {
				toast.error(`Failed to update ${field}`);
				console.error(error);
			} finally {
				setUpdatingField(null);
			}
		},
		[apiFetch, prdId, loadPrd],
	);

	const handleAddTag = useCallback(async () => {
		if (!newTag.trim()) return;
		const updatedTags = [...prd.tags, newTag.trim()];
		await handleInlineUpdate("tags", updatedTags);
		setNewTag("");
	}, [prd, newTag, handleInlineUpdate]);

	const handleRemoveTag = useCallback(
		async (tagToRemove: string) => {
			const updatedTags = prd.tags.filter((tag) => tag !== tagToRemove);
			await handleInlineUpdate("tags", updatedTags);
		},
		[prd, handleInlineUpdate],
	);

	// Title editing handlers
	const handleStartEditingTitle = useCallback(() => {
		setEditedTitle(prd.title);
		setIsEditingTitle(true);
		setTimeout(() => titleInputRef.current?.focus(), 0);
	}, [prd.title]);

	const handleSaveTitle = useCallback(async () => {
		const trimmedTitle = editedTitle.trim();
		if (!trimmedTitle) {
			toast.error("Title cannot be empty");
			return;
		}
		if (trimmedTitle === prd.title) {
			setIsEditingTitle(false);
			return;
		}
		await handleInlineUpdate("title", trimmedTitle);
		setIsEditingTitle(false);
	}, [editedTitle, prd.title, handleInlineUpdate]);

	const handleCancelEditingTitle = useCallback(() => {
		setEditedTitle(prd.title);
		setIsEditingTitle(false);
	}, [prd.title]);

	const handleTitleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleSaveTitle();
			} else if (e.key === "Escape") {
				handleCancelEditingTitle();
			}
		},
		[handleSaveTitle, handleCancelEditingTitle],
	);

	// Auto-save content handler
	const saveContent = useCallback(
		async (content: string) => {
			if (content === lastSavedContentRef.current) return;

			setIsSaving(true);
			try {
				const res = await apiFetch(`/api/prds/${prdId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						content,
					}),
				});
				if (!res.ok) throw new Error("Failed to save content");
				lastSavedContentRef.current = content;
				setLastSavedAt(new Date());
			} catch (error) {
				console.error("Auto-save failed:", error);
				toast.error("Failed to auto-save content");
			} finally {
				setIsSaving(false);
			}
		},
		[apiFetch, prdId],
	);

	// Handle content change with debounced auto-save
	const handleContentChange = useCallback(
		(newContent: string) => {
			setEditorContent(newContent);

			// Clear existing timeout
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			// Set new timeout for auto-save (2 seconds after last change)
			saveTimeoutRef.current = setTimeout(() => {
				saveContent(newContent);
			}, 2000);
		},
		[saveContent],
	);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	const handleDelete = async () => {
		setDeleting(true);
		try {
			const res = await apiFetch(`/api/prds/${prdId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete PRD");
			toast.success("PRD deleted");
			router.push("/project/prds");
		} catch (error) {
			toast.error("Failed to delete PRD");
			console.error(error);
		} finally {
			setDeleting(false);
			setConfirmDeleteOpen(false);
		}
	};

	const handleArchiveToggle = async () => {
		setArchiving(true);
		try {
			const res = await apiFetch(`/api/prds/${prdId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					archived: prd.status !== "archived",
				}),
			});
			if (!res.ok) throw new Error("Failed to update PRD");
			toast.success(
				prd.status === "archived" ? "PRD restored" : "PRD archived",
			);
			await loadPrd();
		} catch (error) {
			toast.error("Failed to update PRD");
			console.error(error);
		} finally {
			setArchiving(false);
			setConfirmArchiveOpen(false);
		}
	};

	const handleRefinePrd = async (focusAreas?: string[]) => {
		setAiLoading(true);
		try {
			toast.info("AI is refining your PRD...");

			const res = await apiFetch("/api/ai/prd/refine", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prdId,
					focusAreas,
				}),
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || "Failed to refine PRD");
			}

			const data = await res.json();
			toast.success("PRD refined successfully");
			setRefineDialogOpen(false);
			await loadPrd();

			// Update editor content with refined content
			if (data.prd?.content) {
				setEditorContent(data.prd.content);
				lastSavedContentRef.current = data.prd.content;
			}

			// Show improvements summary
			if (data.improvements && data.improvements.length > 0) {
				toast.info(
					`Improvements: ${data.improvements.slice(0, 2).join(", ")}${data.improvements.length > 2 ? "..." : ""}`,
				);
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to refine PRD",
			);
			console.error(error);
		} finally {
			setAiLoading(false);
		}
	};

	const handleConvertToSprint = async (data: {
		name: string;
		goal: string;
		deadline: string;
	}) => {
		setConvertLoading(true);
		try {
			toast.info("Creating sprint from PRD...");

			const res = await apiFetch(`/api/prds/${prdId}/convert-to-sprint`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || "Failed to create sprint");
			}

			const result = await res.json();
			toast.success(result.message || "Sprint created successfully");
			setConvertDialogOpen(false);

			// Navigate to the new sprint
			router.push(`/project/sprints/${result.sprint.id}`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create sprint",
			);
			console.error(error);
		} finally {
			setConvertLoading(false);
		}
	};

	const isLoading = aiLoading || convertLoading;

	const handleOpenRefineDialog = () => {
		if (!prd.content?.trim()) {
			toast.error("Add some content before refining");
			return;
		}
		setRefineDialogOpen(true);
	};

	const actions = (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={() => setConfirmArchiveOpen(true)}
				disabled={archiving || isLoading}
			>
				<ArchiveIcon className="w-4 h-4 mr-1" />
				{prd.status === "archived" ? "Restore" : "Archive"}
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() => setConfirmDeleteOpen(true)}
				disabled={isLoading}
			>
				<TrashIcon className="w-4 h-4 mr-1" />
				Delete
			</Button>
			<Button
				variant="default"
				onClick={() => setConvertDialogOpen(true)}
				disabled={isLoading}
			>
				<ArrowsClockwiseIcon className="w-4 h-4 mr-2" />
				{convertLoading ? "Creating..." : "Convert to Sprint"}
			</Button>
		</div>
	);

	const editableTitle = isEditingTitle ? (
		<div className="flex items-center gap-2">
			<Input
				ref={titleInputRef}
				value={editedTitle}
				onChange={(e) => setEditedTitle(e.target.value)}
				onKeyDown={handleTitleKeyDown}
				onBlur={handleSaveTitle}
				className="text-2xl font-bold h-auto py-1 px-2 min-w-[200px]"
				disabled={updatingField === "title"}
			/>
			{updatingField === "title" ? (
				<SpinnerIcon className="h-5 w-5 animate-spin text-muted-foreground" />
			) : (
				<>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleSaveTitle}
						className="h-8 w-8 p-0"
					>
						<CheckIcon className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleCancelEditingTitle}
						className="h-8 w-8 p-0"
					>
						<XIcon className="h-4 w-4" />
					</Button>
				</>
			)}
		</div>
	) : (
		<button
			type="button"
			onClick={handleStartEditingTitle}
			className="group flex items-center gap-2 text-left hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors"
		>
			<span>{prd.title || "Untitled PRD"}</span>
			<PencilSimpleIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
		</button>
	);

	return (
		<>
			<PageHeader
				title={editableTitle}
				backLink={{ href: "/project/prds", label: "Back to PRDs" }}
				actions={actions}
			/>

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Main content - takes 3/4 on large screens */}
				<div className="lg:col-span-3 space-y-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0">
							<CardTitle>Content</CardTitle>
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								{isSaving ? (
									<>
										<span>Saving...</span>
										<SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
									</>
								) : lastSavedAt ? (
									<span>
										Last saved:{" "}
										{formatDistanceToNow(lastSavedAt, { addSuffix: true })}
									</span>
								) : null}
							</div>
						</CardHeader>
						<CardContent>
							<MarkdownEditor
								markdown={editorContent}
								onChange={handleContentChange}
								placeholder="Start writing your PRD content here..."
								onAiRefine={handleOpenRefineDialog}
								aiLoading={aiLoading}
							/>
						</CardContent>
					</Card>
				</div>

				{/* Sidebar - takes 1/4 on large screens */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<p className="text-xs text-muted-foreground mb-1">Status</p>
								<Select
									value={prd.status}
									onValueChange={(value) => handleInlineUpdate("status", value)}
									disabled={updatingField === "status"}
								>
									<SelectTrigger className="w-full h-8">
										<SelectValue>
											<Badge className={statusColors[prd.status]}>
												{updatingField === "status" ? (
													<>
														<SpinnerIcon className="h-3 w-3 animate-spin mr-1" />
														Updating...
													</>
												) : (
													statusLabels[prd.status] || prd.status
												)}
											</Badge>
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="draft">Draft</SelectItem>
										<SelectItem value="review">In Review</SelectItem>
										<SelectItem value="approved">Approved</SelectItem>
										<SelectItem value="archived">Archived</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<p className="text-xs text-muted-foreground mb-1">Priority</p>
								<Select
									value={prd.priority}
									onValueChange={(value) =>
										handleInlineUpdate("priority", value)
									}
									disabled={updatingField === "priority"}
								>
									<SelectTrigger className="w-full h-8">
										<SelectValue>
											<Badge className={priorityColors[prd.priority]}>
												{updatingField === "priority" ? (
													<>
														<SpinnerIcon className="h-3 w-3 animate-spin mr-1" />
														Updating...
													</>
												) : (
													prd.priority
												)}
											</Badge>
										</SelectValue>
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
								<p className="text-xs text-muted-foreground mb-1">Tags</p>
								<div className="flex flex-wrap gap-1 mb-2">
									{prd.tags.map((tag) => (
										<Badge
											key={tag}
											variant="secondary"
											className="text-xs pr-1 flex items-center gap-1"
										>
											{tag}
											<button
												type="button"
												onClick={() => handleRemoveTag(tag)}
												disabled={updatingField === "tags"}
												className="ml-0.5 hover:bg-muted-foreground/20 rounded-full p-0.5"
											>
												<XIcon className="h-3 w-3" />
											</button>
										</Badge>
									))}
								</div>
								<div className="flex gap-1">
									<Input
										value={newTag}
										onChange={(e) => setNewTag(e.target.value)}
										placeholder="Add tag..."
										className="h-7 text-xs"
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddTag();
											}
										}}
										disabled={updatingField === "tags"}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-7 w-7 p-0"
										onClick={handleAddTag}
										disabled={!newTag.trim() || updatingField === "tags"}
									>
										{updatingField === "tags" ? (
											<SpinnerIcon className="h-3 w-3 animate-spin" />
										) : (
											<PlusIcon className="h-3 w-3" />
										)}
									</Button>
								</div>
							</div>
							<div className="pt-2 border-t">
								<p className="text-xs text-muted-foreground mb-1">Created</p>
								<p className="text-sm">
									{format(new Date(prd.createdAt), "MMM d, yyyy 'at' h:mm a")}
								</p>
							</div>
							{prd.updatedAt && prd.updatedAt !== prd.createdAt && (
								<div>
									<p className="text-xs text-muted-foreground mb-1">
										Last Updated
									</p>
									<p className="text-sm">
										{format(new Date(prd.updatedAt), "MMM d, yyyy 'at' h:mm a")}
									</p>
								</div>
							)}
							{prd.archivedAt && (
								<div>
									<p className="text-xs text-muted-foreground mb-1">Archived</p>
									<p className="text-sm">
										{format(
											new Date(prd.archivedAt),
											"MMM d, yyyy 'at' h:mm a",
										)}
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>

			{/* AI Refine Dialog */}
			<RefinePrdDialog
				open={refineDialogOpen}
				onOpenChange={setRefineDialogOpen}
				onSubmit={handleRefinePrd}
				loading={aiLoading}
			/>

			{/* Convert to Sprint Dialog */}
			<ConvertToSprintDialog
				open={convertDialogOpen}
				onOpenChange={setConvertDialogOpen}
				onSubmit={handleConvertToSprint}
				loading={convertLoading}
				prdTitle={prd.title || "Untitled PRD"}
			/>

			{/* Archive Confirmation */}
			<AlertDialog
				open={confirmArchiveOpen}
				onOpenChange={setConfirmArchiveOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{prd.status === "archived"
								? "Restore this PRD?"
								: "Archive this PRD?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{prd.status === "archived"
								? `This will restore "${prd.title}" and make it visible in the main PRD list.`
								: `This will archive "${prd.title}". Archived PRDs can be restored later.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleArchiveToggle}
							disabled={archiving}
						>
							{archiving
								? prd.status === "archived"
									? "Restoring..."
									: "Archiving..."
								: prd.status === "archived"
									? "Restore PRD"
									: "Archive PRD"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Delete Confirmation */}
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
