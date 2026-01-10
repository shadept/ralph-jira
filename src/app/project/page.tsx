"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, FolderOpen, Sparkle, GearSix, ListChecks } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Board } from "@/lib/schemas";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectContext } from "@/components/projects/project-provider";
import { AppLayout } from "@/components/layout/app-layout";
import { BoardPropertiesDialog } from "@/components/board-properties-dialog";

export default function ProjectPage() {
	const router = useRouter();
	const {
		currentProject,
		loading: projectLoading,
		apiFetch,
	} = useProjectContext();
	// Using Board type for backward compatibility with API response
	const [sprints, setSprints] = useState<Board[]>([]);
	const [loading, setLoading] = useState(true);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	const loadSprints = useCallback(async () => {
		if (!currentProject) {
			setSprints([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const res = await apiFetch("/api/boards");
			const data = await res.json();
			setSprints(data.boards);
		} catch (error) {
			toast.error("Failed to load sprints");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject]);

	useEffect(() => {
		loadSprints();
	}, [loadSprints]);

	const handleCreateSprint = async (newSprint: Board) => {
		if (!currentProject) return;

		try {
			const res = await apiFetch("/api/boards", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newSprint),
			});

			if (!res.ok) throw new Error("Failed to create sprint");

			toast.success("Sprint created");
			setCreateDialogOpen(false);
			router.push(`/project/sprints/${newSprint.id}`);
		} catch (error) {
			toast.error("Failed to create sprint");
			console.error(error);
		}
	};

	const getStatusColor = (status: Board["status"]) => {
		switch (status) {
			case "active":
				return "bg-green-500/10 text-green-700 dark:text-green-300";
			case "planned":
				return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
			case "completed":
				return "bg-gray-500/10 text-gray-700 dark:text-gray-300";
			case "archived":
				return "bg-slate-500/10 text-slate-700 dark:text-slate-300";
			default:
				return "";
		}
	};

	const actions = (
		<>
			{currentProject && (
				<Button onClick={() => setCreateDialogOpen(true)}>
					<Plus className="w-4 h-4 mr-2" />
					New Sprint
				</Button>
			)}
			<Button
				variant="ghost"
				size="icon"
				onClick={() => router.push("/project/settings")}
			>
				<GearSix className="w-5 h-5" />
				<span className="sr-only">Settings</span>
			</Button>
		</>
	);

	const activeSprint = useMemo(
		() => sprints.find((s) => s.id === "prd" || s.id === "initial-sprint"),
		[sprints],
	);

	const renderContent = () => {
		if (projectLoading) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading projects…</p>
				</div>
			);
		}

		if (!currentProject) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">No project selected</p>
					<p className="text-sm text-muted-foreground max-w-md">
						Use the project picker in the top right corner to add or switch
						projects. Ralph will scaffold any missing planning files for you.
					</p>
				</div>
			);
		}

		if (loading) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading sprints…</p>
				</div>
			);
		}

		return (
			<div className="space-y-10">
				{activeSprint && (
					<section>
						<Card className="border-primary/40">
							<CardHeader>
								<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-2">
											<CardTitle>{activeSprint.name}</CardTitle>
											<Badge className={getStatusColor(activeSprint.status)}>
												{activeSprint.status}
											</Badge>
										</div>
										<CardDescription>{activeSprint.goal}</CardDescription>
									</div>
									<Button
										onClick={() => router.push(`/project/sprints/${activeSprint.id}`)}
									>
										<FolderOpen className="w-4 h-4 mr-2" />
										Open Sprint
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
									<Stat label="Total Tasks" value={activeSprint.tasks.length} />
									<Stat
										label="Completed"
										value={
											activeSprint.tasks.filter((t) => t.status === "done")
												.length
										}
									/>
									<Stat
										label="In Progress"
										value={
											activeSprint.tasks.filter(
												(t) => t.status === "in_progress",
											).length
										}
									/>
									<div>
										<p className="text-muted-foreground">Deadline</p>
										<p className="text-lg font-semibold">
											{format(new Date(activeSprint.deadline), "MMM d, yyyy")}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</section>
				)}

				<section>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-2xl font-semibold">All Sprints</h2>
						<Button variant="ghost" size="sm" onClick={loadSprints}>
							Refresh
						</Button>
					</div>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{sprints.map((sprint) => (
							<Card
								key={sprint.id}
								className="cursor-pointer transition-shadow hover:shadow-lg"
								onClick={() => router.push(`/project/sprints/${sprint.id}`)}
							>
								<CardHeader>
									<div className="flex items-center justify-between mb-2">
										<CardTitle className="text-lg">{sprint.name}</CardTitle>
										<Badge className={getStatusColor(sprint.status)}>
											{sprint.status}
										</Badge>
									</div>
									<CardDescription className="line-clamp-2">
										{sprint.goal}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex justify-between text-sm text-muted-foreground">
										<span>{sprint.tasks.length} tasks</span>
										<span>
											{sprint.tasks.filter((t) => t.status === "done").length}{" "}
											done
										</span>
									</div>
								</CardContent>
							</Card>
						))}
						{sprints.length === 0 && (
							<Card className="border-dashed">
								<CardHeader>
									<CardTitle>No sprints yet</CardTitle>
									<CardDescription>
										Kick off your first sprint by creating a new one.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button onClick={() => setCreateDialogOpen(true)}>
										<Plus className="w-4 h-4 mr-2" />
										Create Sprint
									</Button>
								</CardContent>
							</Card>
						)}
					</div>
				</section>

				<section>
					<div className="grid gap-4 md:grid-cols-3">
						<Card
							className="cursor-pointer transition-shadow hover:shadow-lg"
							onClick={() => router.push("/project/tasks")}
						>
							<CardHeader>
								<CardTitle className="text-lg flex items-center gap-2">
									<ListChecks className="w-5 h-5" />
									All Tasks
								</CardTitle>
								<CardDescription>
									View all tasks across all sprints
								</CardDescription>
							</CardHeader>
						</Card>

						<Card
							className="cursor-pointer transition-shadow hover:shadow-lg"
							onClick={() => router.push("/project/files")}
						>
							<CardHeader>
								<CardTitle className="text-lg">Files</CardTitle>
								<CardDescription>
									View planning artifacts and progress logs
								</CardDescription>
							</CardHeader>
						</Card>

						<Card
							className="cursor-pointer transition-shadow hover:shadow-lg"
							onClick={() => router.push("/project/assistant")}
						>
							<CardHeader>
								<CardTitle className="text-lg flex items-center gap-2">
									<Sparkle className="w-5 h-5" />
									AI Assistant
								</CardTitle>
								<CardDescription>
									Chat with AI to manage your project
								</CardDescription>
							</CardHeader>
						</Card>
					</div>
				</section>
			</div>
		);
	};

	return (
		<AppLayout
			title="Project Management"
			description="Manage your sprints and tasks with AI assistance"
			actions={actions}
		>
			{renderContent()}

			<BoardPropertiesDialog
				board={null}
				open={createDialogOpen}
				onClose={() => setCreateDialogOpen(false)}
				onSave={handleCreateSprint}
				mode="create"
			/>
		</AppLayout>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div>
			<p className="text-muted-foreground">{label}</p>
			<p className="text-2xl font-bold">{value}</p>
		</div>
	);
}
