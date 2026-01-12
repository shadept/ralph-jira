"use client";

import {
	ArchiveIcon,
	FileTextIcon,
	PlusIcon,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { PrdEditorDialog } from "@/components/prd-editor-dialog";
import { useProjectContext } from "@/components/projects/project-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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

function PrdCard({
	prd,
	onClick,
}: {
	prd: Prd;
	onClick: () => void;
}) {
	return (
		<Card
			className="cursor-pointer hover:shadow-md transition-shadow"
			onClick={onClick}
		>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2 mb-1">
					<Badge variant="outline" className={statusColors[prd.status]}>
						{statusLabels[prd.status] || prd.status}
					</Badge>
					<Badge variant="outline" className={priorityColors[prd.priority]}>
						{prd.priority}
					</Badge>
				</div>
				<CardTitle className="text-lg line-clamp-2">
					{prd.title || "Untitled PRD"}
				</CardTitle>
				{prd.content && (
					<CardDescription className="line-clamp-2">
						{prd.content.substring(0, 150)}
						{prd.content.length > 150 ? "..." : ""}
					</CardDescription>
				)}
			</CardHeader>
			<CardContent className="pt-0">
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<div className="flex flex-wrap gap-1">
						{prd.tags.slice(0, 3).map((tag) => (
							<Badge key={tag} variant="secondary" className="text-xs">
								{tag}
							</Badge>
						))}
						{prd.tags.length > 3 && (
							<Badge variant="secondary" className="text-xs">
								+{prd.tags.length - 3}
							</Badge>
						)}
					</div>
					<span>{format(new Date(prd.createdAt), "MMM d, yyyy")}</span>
				</div>
			</CardContent>
		</Card>
	);
}

export default function PrdsPage() {
	const router = useRouter();
	const { currentProject, apiFetch } = useProjectContext();

	const [prds, setPrds] = useState<Prd[]>([]);
	const [loading, setLoading] = useState(true);
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [showArchived, setShowArchived] = useState(false);

	// Editor dialog state
	const [selectedPrd, setSelectedPrd] = useState<Prd | null>(null);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editorMode, setEditorMode] = useState<"create" | "edit">("create");

	const loadPrds = useCallback(async () => {
		if (!currentProject) {
			setPrds([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			let url = "/api/prds";
			const params = new URLSearchParams();
			if (showArchived) {
				params.set("includeArchived", "true");
			}
			if (statusFilter !== "all") {
				params.set("status", statusFilter);
			}
			if (params.toString()) {
				url += `?${params.toString()}`;
			}

			const res = await apiFetch(url);
			const data = await res.json();
			setPrds(data.prds || []);
		} catch (error) {
			toast.error("Failed to load PRDs");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject, showArchived, statusFilter]);

	useEffect(() => {
		loadPrds();
	}, [loadPrds]);

	const handleNewPrd = () => {
		const newPrd: Prd = {
			id: `prd-${Date.now()}`,
			projectId: currentProject?.id || "default",
			title: "",
			content: "",
			status: "draft",
			priority: "medium",
			tags: [],
			order: 0,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			archivedAt: null,
		};
		setSelectedPrd(newPrd);
		setEditorMode("create");
		setIsEditorOpen(true);
	};

	const handlePrdClick = (prd: Prd) => {
		// Navigate to detail page
		router.push(`/project/prds/${prd.id}`);
	};

	const handleEditPrd = (prd: Prd) => {
		setSelectedPrd(prd);
		setEditorMode("edit");
		setIsEditorOpen(true);
	};

	const handleCloseEditor = () => {
		setIsEditorOpen(false);
		setSelectedPrd(null);
	};

	const handleSavePrd = async (updatedPrd: Prd) => {
		try {
			if (editorMode === "create") {
				const res = await apiFetch("/api/prds", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title: updatedPrd.title,
						content: updatedPrd.content,
						status: updatedPrd.status,
						priority: updatedPrd.priority,
						tags: updatedPrd.tags,
					}),
				});
				if (!res.ok) throw new Error("Failed to create PRD");
				toast.success("PRD created");
			} else {
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
			}
			handleCloseEditor();
			await loadPrds();
		} catch (error) {
			toast.error(
				editorMode === "create" ? "Failed to create PRD" : "Failed to update PRD",
			);
			console.error(error);
		}
	};

	const handleDeletePrd = async (prdId: string) => {
		try {
			const res = await apiFetch(`/api/prds/${prdId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete PRD");
			toast.success("PRD deleted");
			handleCloseEditor();
			await loadPrds();
		} catch (error) {
			toast.error("Failed to delete PRD");
			console.error(error);
		}
	};

	const actions = currentProject ? (
		<div className="flex items-center gap-2">
			<Select value={statusFilter} onValueChange={setStatusFilter}>
				<SelectTrigger className="w-[140px]">
					<SelectValue placeholder="Filter status" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Statuses</SelectItem>
					<SelectItem value="draft">Draft</SelectItem>
					<SelectItem value="review">In Review</SelectItem>
					<SelectItem value="approved">Approved</SelectItem>
				</SelectContent>
			</Select>
			<Button
				variant={showArchived ? "secondary" : "outline"}
				size="sm"
				onClick={() => setShowArchived(!showArchived)}
			>
				<ArchiveIcon className="w-4 h-4 mr-1" />
				{showArchived ? "Hide Archived" : "Show Archived"}
			</Button>
			<Button onClick={handleNewPrd}>
				<PlusIcon className="w-4 h-4 mr-2" />
				New PRD
			</Button>
		</div>
	) : null;

	const renderContent = () => {
		if (!currentProject) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">No project selected</p>
					<p className="text-sm text-muted-foreground max-w-md">
						Use the project picker in the header to select or create a
						workspace.
					</p>
				</div>
			);
		}

		if (loading) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading PRDs...</p>
				</div>
			);
		}

		if (prds.length === 0) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<FileTextIcon className="w-12 h-12 text-muted-foreground" />
					<p className="text-lg font-semibold">No PRDs yet</p>
					<p className="text-sm text-muted-foreground max-w-md">
						{statusFilter !== "all"
							? `No PRDs with status "${statusLabels[statusFilter] || statusFilter}" found.`
							: "Create your first Product Requirements Document to get started."}
					</p>
					{statusFilter === "all" && (
						<Button onClick={handleNewPrd} className="mt-2">
							<PlusIcon className="w-4 h-4 mr-2" />
							Create PRD
						</Button>
					)}
				</div>
			);
		}

		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{prds.map((prd) => (
					<PrdCard key={prd.id} prd={prd} onClick={() => handlePrdClick(prd)} />
				))}
			</div>
		);
	};

	return (
		<>
			<PageHeader
				title="PRDs"
				description={
					prds.length > 0
						? `${prds.length} Product Requirements Document${prds.length === 1 ? "" : "s"}`
						: "Manage your Product Requirements Documents"
				}
				backLink={{ href: "/project", label: "Back to Project" }}
				actions={actions}
			/>
			{renderContent()}

			<PrdEditorDialog
				prd={selectedPrd}
				open={isEditorOpen}
				onClose={handleCloseEditor}
				onSave={handleSavePrd}
				onDelete={editorMode === "edit" ? handleDeletePrd : undefined}
				mode={editorMode}
			/>
		</>
	);
}
