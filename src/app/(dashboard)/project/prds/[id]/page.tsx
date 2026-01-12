"use client";

import {
	ArchiveIcon,
	ArrowsClockwiseIcon,
	ListBulletsIcon,
	PencilIcon,
	SparkleIcon,
	SpinnerIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { format, formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MarkdownEditorLoading } from "@/components/markdown-editor";

// Dynamic import of MDXEditor to avoid SSR issues
const MarkdownEditor = dynamic(
	() => import("@/components/markdown-editor").then((mod) => mod.MarkdownEditor),
	{
		ssr: false,
		loading: () => <MarkdownEditorLoading />,
	}
);
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Prd, Sprint } from "@/lib/schemas";

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

function GenerateTasksDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
	sprints,
	loadingSprints,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: { sprintId: string; taskCount?: number }) => Promise<void>;
	loading: boolean;
	sprints: Sprint[];
	loadingSprints: boolean;
}) {
	const form = useForm({
		defaultValues: {
			sprintId: "",
			taskCount: "",
		},
		onSubmit: async ({ value }) => {
			if (!value.sprintId) return;
			await onSubmit({
				sprintId: value.sprintId,
				taskCount: value.taskCount ? parseInt(value.taskCount, 10) : undefined,
			});
		},
	});

	useEffect(() => {
		if (open) {
			form.reset();
			// Auto-select the first sprint if there's only one
			if (sprints.length === 1) {
				form.setFieldValue("sprintId", sprints[0].id);
			}
		}
	}, [open, form, sprints]);

	const activeSprints = sprints.filter(
		(s) => s.status === "planning" || s.status === "active"
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Generate Tasks from PRD</DialogTitle>
					<DialogDescription>
						AI will analyze this PRD and generate development tasks for the selected sprint.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<div className="space-y-4">
						<form.Field name="sprintId">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Target Sprint *</Label>
									{loadingSprints ? (
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<SpinnerIcon className="h-4 w-4 animate-spin" />
											Loading sprints...
										</div>
									) : activeSprints.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No active sprints found. Please create a sprint first or convert this PRD to a sprint.
										</p>
									) : (
										<Select
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value)}
											disabled={loading}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select a sprint" />
											</SelectTrigger>
											<SelectContent>
												{activeSprints.map((sprint) => (
													<SelectItem key={sprint.id} value={sprint.id}>
														{sprint.name} ({sprint.status})
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								</div>
							)}
						</form.Field>

						<form.Field name="taskCount">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Number of Tasks (optional)</Label>
									<Input
										id={field.name}
										type="number"
										min="1"
										max="20"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Leave empty for AI to decide"
										disabled={loading}
									/>
									<p className="text-xs text-muted-foreground">
										Leave empty to let AI determine the appropriate number of tasks based on PRD complexity.
									</p>
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
						<form.Subscribe selector={(state) => state.values.sprintId}>
							{(sprintId) => (
								<Button
									type="submit"
									disabled={loading || !sprintId || activeSprints.length === 0}
								>
									{loading ? (
										<>
											Generating
											<SpinnerIcon className="ml-2 h-4 w-4 animate-spin" />
										</>
									) : (
										<>
											<ListBulletsIcon className="mr-2 h-4 w-4" />
											Generate Tasks
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

	// Archive confirmation state
	const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
	const [archiving, setArchiving] = useState(false);

	// AI action states
	const [draftDialogOpen, setDraftDialogOpen] = useState(false);
	const [refineDialogOpen, setRefineDialogOpen] = useState(false);
	const [aiLoading, setAiLoading] = useState(false);

	// Convert to Sprint states
	const [convertDialogOpen, setConvertDialogOpen] = useState(false);
	const [convertLoading, setConvertLoading] = useState(false);

	// Generate Tasks states
	const [generateTasksDialogOpen, setGenerateTasksDialogOpen] = useState(false);
	const [generateTasksLoading, setGenerateTasksLoading] = useState(false);
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [loadingSprints, setLoadingSprints] = useState(false);

	// Content editing & auto-save states
	const [editorContent, setEditorContent] = useState<string>("");
	const [isSaving, setIsSaving] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastSavedContentRef = useRef<string>("");

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

	const loadSprints = useCallback(async () => {
		if (!currentProject) {
			setSprints([]);
			return;
		}

		setLoadingSprints(true);
		try {
			const res = await apiFetch(`/api/projects/${currentProject.id}/sprints`);
			if (!res.ok) {
				throw new Error("Failed to load sprints");
			}
			const data = await res.json();
			setSprints(data.sprints || []);
		} catch (error) {
			console.error("Failed to load sprints:", error);
			setSprints([]);
		} finally {
			setLoadingSprints(false);
		}
	}, [apiFetch, currentProject]);

	useEffect(() => {
		loadPrd();
	}, [loadPrd]);

	// Sync editor content when PRD loads
	useEffect(() => {
		if (prd) {
			const content = prd.content ?? "";
			setEditorContent(content);
			lastSavedContentRef.current = content;
			// Set initial lastSavedAt based on PRD updatedAt
			if (prd.updatedAt) {
				setLastSavedAt(new Date(prd.updatedAt));
			}
		}
	}, [prd]);

	// Auto-save content handler
	const saveContent = useCallback(async (content: string) => {
		if (!prd || content === lastSavedContentRef.current) return;

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
	}, [apiFetch, prd, prdId]);

	// Handle content change with debounced auto-save
	const handleContentChange = useCallback((newContent: string) => {
		setEditorContent(newContent);

		// Clear existing timeout
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}

		// Set new timeout for auto-save (2 seconds after last change)
		saveTimeoutRef.current = setTimeout(() => {
			saveContent(newContent);
		}, 2000);
	}, [saveContent]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	// Load sprints when generate tasks dialog opens
	useEffect(() => {
		if (generateTasksDialogOpen) {
			loadSprints();
		}
	}, [generateTasksDialogOpen, loadSprints]);

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
			setConfirmArchiveOpen(false);
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

	const handleGenerateTasks = async (data: { sprintId: string; taskCount?: number }) => {
		if (!currentProject || !prd) return;

		setGenerateTasksLoading(true);
		try {
			toast.info("Generating tasks from PRD...");

			const res = await apiFetch("/api/ai/prd/generate-tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prdId,
					sprintId: data.sprintId,
					taskCount: data.taskCount,
				}),
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || "Failed to generate tasks");
			}

			const result = await res.json();
			toast.success(`${result.taskCount} tasks generated successfully!`);
			setGenerateTasksDialogOpen(false);

			// Navigate to the sprint to see the new tasks
			router.push(`/project/sprints/${data.sprintId}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to generate tasks");
			console.error(error);
		} finally {
			setGenerateTasksLoading(false);
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

	const isLoading = aiLoading || convertLoading || generateTasksLoading;

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
					<DropdownMenuItem
						onClick={() => setGenerateTasksDialogOpen(true)}
						disabled={!prd.content?.trim()}
					>
						Generate Tasks from PRD
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
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
						<CardHeader className="flex flex-row items-center justify-between space-y-0">
							<CardTitle>Content</CardTitle>
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								{isSaving ? (
									<>
										<span>Saving...</span>
										<SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
									</>
								) : lastSavedAt ? (
									<span>Last saved: {formatDistanceToNow(lastSavedAt, { addSuffix: true })}</span>
								) : null}
							</div>
						</CardHeader>
						<CardContent>
							<MarkdownEditor
								markdown={editorContent}
								onChange={handleContentChange}
								placeholder="Start writing your PRD content here... Use AI Actions to draft content."
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

			{/* Generate Tasks Dialog */}
			<GenerateTasksDialog
				open={generateTasksDialogOpen}
				onOpenChange={setGenerateTasksDialogOpen}
				onSubmit={handleGenerateTasks}
				loading={generateTasksLoading}
				sprints={sprints}
				loadingSprints={loadingSprints}
			/>

			{/* Archive Confirmation */}
			<AlertDialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{prd.status === "archived" ? "Restore this PRD?" : "Archive this PRD?"}
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
