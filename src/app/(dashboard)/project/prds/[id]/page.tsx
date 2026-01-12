"use client";

import {
	ArchiveIcon,
	PencilIcon,
	TrashIcon,
} from "@phosphor-icons/react";
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

	const actions = (
		<div className="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={handleArchiveToggle}
				disabled={archiving}
			>
				<ArchiveIcon className="w-4 h-4 mr-1" />
				{prd.status === "archived" ? "Restore" : "Archive"}
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() => setConfirmDeleteOpen(true)}
			>
				<TrashIcon className="w-4 h-4 mr-1" />
				Delete
			</Button>
			<Button onClick={handleEdit}>
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
								<p className="text-muted-foreground italic">
									No content yet. Click Edit to add requirements.
								</p>
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
