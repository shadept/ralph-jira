"use client";

import {
	ArchiveIcon,
	ArrowsClockwiseIcon,
	PencilIcon,
	SparkleIcon,
	SpinnerIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { PrdEditorDialog } from "@/components/prd-editor-dialog";
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
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Prd } from "@/lib/schemas";

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

function DraftPrdDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (description: string, additionalContext?: string) => Promise<void>;
	loading: boolean;
}) {
	const form = useForm({
		defaultValues: {
			description: "",
			additionalContext: "",
		},
		onSubmit: async ({ value }) => {
			if (!value.description.trim()) return;
			await onSubmit(value.description.trim(), value.additionalContext.trim() || undefined);
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
					<DialogTitle>Draft PRD with AI</DialogTitle>
					<DialogDescription>
						Describe the feature or product you want to document and AI will generate a comprehensive PRD.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<div className="space-y-4">
						<form.Field name="description">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Feature Description *</Label>
									<Textarea
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="e.g., A user authentication system with email/password login, OAuth support, password reset, and session management"
										rows={4}
										autoFocus
										disabled={loading}
									/>
									<p className="text-xs text-muted-foreground">
										Be specific about what you want to build. The more detail, the better the PRD.
									</p>
								</div>
							)}
						</form.Field>

						<form.Field name="additionalContext">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Additional Context (optional)</Label>
									<Textarea
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="e.g., Target audience, specific requirements, constraints, integrations..."
										rows={2}
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
						<form.Subscribe selector={(state) => state.values.description}>
							{(description) => (
								<Button type="submit" disabled={loading || !description.trim()}>
									{loading ? (
										<>
											Generating
											<SpinnerIcon className="ml-2 h-4 w-4 animate-spin" />
										</>
									) : (
										<>
											<SparkleIcon className="mr-2 h-4 w-4" />
											Generate PRD
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
						AI will review and improve your PRD for clarity, completeness, and actionability.
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
									Enter specific areas to focus on (one per line), or leave empty for general improvement.
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
	onSubmit: (data: { name: string; goal: string; deadline: string }) => Promise<void>;
	loading: boolean;
	prdTitle: string;
}) {
	const form = useForm({
		defaultValues: {
			name: `Sprint: ${prdTitle}`,
			goal: "",
			deadline: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // Default to 2 weeks from now
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
			form.setFieldValue("deadline", format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
		}
	}, [open, prdTitle, form]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Convert PRD to Sprint</DialogTitle>
					<DialogDescription>
						Create a new sprint from this PRD. The sprint will be linked to the source PRD.
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
						<form.Subscribe selector={(state) => ({ name: state.values.name, deadline: state.values.deadline })}>
							{({ name, deadline }) => (
								<Button type="submit" disabled={loading || !name.trim() || !deadline}>
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

export default function PrdDetailPage() {
	const params = useParams();
	const router = useRouter();
	const { currentProject, apiFetch } = useProjectContext();

	const prdId = params.id as string;

	const [prd, setPrd] = useState<Prd | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	// Editor dialog state
	const [isEditorOpen, setIsEditorOpen] = useState(false);

	// Delete confirmation state
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// Archive state
	const [archiving, setArchiving] = useState(false);

	// AI action states
	const [draftDialogOpen, setDraftDialogOpen] = useState(false);
	const [refineDialogOpen, setRefineDialogOpen] = useState(false);
	const [aiLoading, setAiLoading] = useState(false);

	// Convert to Sprint states
	const [convertDialogOpen, setConvertDialogOpen] = useState(false);
	const [convertLoading, setConvertLoading] = useState(false);

	const loadPrd = useCallback(async () => {
		if (!currentProject || !prdId) {
			setPrd(null);
			setLoading(false);
			return;
		}

		setLoading(true);
		setNotFound(false);
		try {
			const res = await apiFetch(`/api/prds/${prdId}`);
			if (!res.ok) {
				if (res.status === 404) {
					setNotFound(true);
					setPrd(null);
					return;
				}
				throw new Error("Failed to load PRD");
			}
			const data = await res.json();
			setPrd(data.prd);
		} catch (error) {
			toast.error("Failed to load PRD");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject, prdId]);

	useEffect(() => {
		loadPrd();
	}, [loadPrd]);

	const handleEdit = () => {
		setIsEditorOpen(true);
	};

	const handleCloseEditor = () => {
		setIsEditorOpen(false);
	};

	const handleSavePrd = async (updatedPrd: Prd) => {
		try {
			const res = await apiFetch(`/api/prds/${updatedPrd.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: updatedPrd.title,
					content: updatedPrd.content,
					status: updatedPrd.status,
					priority: updatedPrd.priority,
					tags: updatedPrd.tags,
				}),
			});
			if (!res.ok) throw new Error("Failed to update PRD");
			toast.success("PRD updated");
			handleCloseEditor();
			await loadPrd();
		} catch (error) {
			toast.error("Failed to update PRD");
			console.error(error);
		}
	};

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
		if (!prd) return;
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
		}
	};

	const handleDraftPrd = async (description: string, additionalContext?: string) => {
		setAiLoading(true);
		try {
			toast.info("AI is generating your PRD...");

			const res = await apiFetch("/api/ai/prd/draft", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prdId,
					description,
					additionalContext,
				}),
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || "Failed to generate PRD");
			}

			const data = await res.json();
			toast.success("PRD generated successfully");
			setDraftDialogOpen(false);
			await loadPrd();

			// Show suggested title if it was applied
			if (data.suggestedTitle) {
				toast.info(`Title set to: "${data.suggestedTitle}"`);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to generate PRD");
			console.error(error);
		} finally {
			setAiLoading(false);
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

			// Show improvements summary
			if (data.improvements && data.improvements.length > 0) {
				toast.info(`Improvements: ${data.improvements.slice(0, 2).join(", ")}${data.improvements.length > 2 ? "..." : ""}`);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to refine PRD");
			console.error(error);
		} finally {
			setAiLoading(false);
		}
	};

	const handleConvertToSprint = async (data: { name: string; goal: string; deadline: string }) => {
		if (!currentProject) return;

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
			toast.error(error instanceof Error ? error.message : "Failed to create sprint");
			console.error(error);
		} finally {
			setConvertLoading(false);
		}
	};

	if (!currentProject) {
		return (
			<>
				<PageHeader
					title="PRD"
					backLink={{ href: "/project/prds", label: "Back to PRDs" }}
				/>
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">No project selected</p>
					<p className="text-sm text-muted-foreground max-w-md">
						Use the project picker in the header to select a workspace.
					</p>
				</div>
			</>
		);
	}

	if (loading) {
		return (
			<>
				<PageHeader
					title="PRD"
					backLink={{ href: "/project/prds", label: "Back to PRDs" }}
				/>
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading PRD...</p>
				</div>
			</>
		);
	}

	if (notFound || !prd) {
		return (
			<>
				<PageHeader
					title="PRD Not Found"
					backLink={{ href: "/project/prds", label: "Back to PRDs" }}
				/>
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">PRD not found</p>
					<p className="text-sm text-muted-foreground max-w-md">
						This PRD may have been deleted or you don't have access to it.
					</p>
					<Button onClick={() => router.push("/project/prds")} className="mt-2">
						Back to PRDs
					</Button>
				</div>
			</>
		);
	}

	const isLoading = aiLoading || convertLoading;

	const actions = (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant="default"
				onClick={() => setConvertDialogOpen(true)}
				disabled={isLoading}
			>
				<ArrowsClockwiseIcon className="w-4 h-4 mr-2" />
				{convertLoading ? "Creating..." : "Convert to Sprint"}
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" disabled={isLoading}>
						<SparkleIcon className="w-4 h-4 mr-2" />
						{aiLoading ? "AI Working..." : "AI Actions"}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem onClick={() => setDraftDialogOpen(true)}>
						Draft from Description
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => setRefineDialogOpen(true)}
						disabled={!prd.content?.trim()}
					>
						Refine & Improve
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Button
				variant="outline"
				size="sm"
				onClick={handleArchiveToggle}
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
			<Button onClick={handleEdit} disabled={isLoading}>
				<PencilIcon className="w-4 h-4 mr-2" />
				Edit
			</Button>
		</div>
	);

	return (
		<>
			<PageHeader
				title={prd.title || "Untitled PRD"}
				backLink={{ href: "/project/prds", label: "Back to PRDs" }}
				actions={actions}
			/>

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Main content - takes 3/4 on large screens */}
				<div className="lg:col-span-3 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Content</CardTitle>
						</CardHeader>
						<CardContent>
							{prd.content ? (
								<div className="prose dark:prose-invert max-w-none">
									<pre className="whitespace-pre-wrap font-sans text-sm">
										{prd.content}
									</pre>
								</div>
							) : (
								<div className="text-center py-8">
									<p className="text-muted-foreground italic mb-4">
										No content yet. Use AI to draft your PRD or add content manually.
									</p>
									<Button
										variant="outline"
										onClick={() => setDraftDialogOpen(true)}
										disabled={aiLoading}
									>
										<SparkleIcon className="w-4 h-4 mr-2" />
										Draft with AI
									</Button>
								</div>
							)}
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
								<Badge className={statusColors[prd.status]}>
									{statusLabels[prd.status] || prd.status}
								</Badge>
							</div>
							<div>
								<p className="text-xs text-muted-foreground mb-1">Priority</p>
								<Badge className={priorityColors[prd.priority]}>
									{prd.priority}
								</Badge>
							</div>
							{prd.tags.length > 0 && (
								<div>
									<p className="text-xs text-muted-foreground mb-1">Tags</p>
									<div className="flex flex-wrap gap-1">
										{prd.tags.map((tag) => (
											<Badge key={tag} variant="secondary" className="text-xs">
												{tag}
											</Badge>
										))}
									</div>
								</div>
							)}
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

			{/* Editor Dialog */}
			<PrdEditorDialog
				prd={prd}
				open={isEditorOpen}
				onClose={handleCloseEditor}
				onSave={handleSavePrd}
				onDelete={handleDelete}
				mode="edit"
			/>

			{/* AI Draft Dialog */}
			<DraftPrdDialog
				open={draftDialogOpen}
				onOpenChange={setDraftDialogOpen}
				onSubmit={handleDraftPrd}
				loading={aiLoading}
			/>

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
