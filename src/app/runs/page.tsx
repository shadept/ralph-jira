"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import { useProjectContext } from "@/components/projects/project-provider";
import { RunRecord } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RUN_STATUS_STYLES: Record<RunRecord["status"], string> = {
	queued:
		"bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-200",
	running:
		"bg-emerald-200 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
	stopped:
		"bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
	completed: "bg-blue-200 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100",
	failed: "bg-red-200 text-red-900 dark:bg-red-500/20 dark:text-red-100",
	canceled: "bg-gray-200 text-gray-900 dark:bg-gray-500/20 dark:text-gray-100",
};

const formatDate = (value?: string | null) => {
	if (!value) return "—";
	try {
		return new Date(value).toLocaleString();
	} catch {
		return value;
	}
};

const formatReason = (reason?: string | null) => {
	if (!reason) return "—";
	return reason.replace(/_/g, " ");
};

export default function RunsPage() {
	const router = useRouter();
	const {
		currentProject,
		loading: projectLoading,
		apiFetch,
	} = useProjectContext();
	const [runs, setRuns] = useState<RunRecord[]>([]);
	const [loading, setLoading] = useState(true);

	const loadRuns = useCallback(async () => {
		if (!currentProject) {
			setRuns([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const res = await apiFetch("/api/runs");
			const data = await res.json();
			setRuns(data.runs || []);
		} catch (error) {
			console.error("Failed to load runs", error);
			toast.error("Failed to load runs");
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject]);

	useEffect(() => {
		loadRuns();
	}, [loadRuns]);

	const actions = currentProject ? (
		<Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
			Refresh Runs
		</Button>
	) : undefined;

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
						Use the project switcher to select a workspace and view its run
						history.
					</p>
				</div>
			);
		}

		if (loading) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading runs…</p>
				</div>
			);
		}

		if (!runs.length) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">No runs yet</p>
					<p className="text-sm text-muted-foreground max-w-md">
						Start the AI loop from any board to populate run history.
					</p>
				</div>
			);
		}

		return (
			<div className="space-y-4">
				{runs.map((run) => (
					<Card key={run.runId} className="border border-border/70">
						<CardHeader className="flex flex-row items-start justify-between gap-4">
							<div>
								<CardTitle className="text-base">
									{run.sprintName || run.sprintId}
								</CardTitle>
								<CardDescription>
									Run ID: {run.runId}
									<br />
									Branch: {run.sandboxBranch || "—"}
								</CardDescription>
							</div>
							<Badge className={RUN_STATUS_STYLES[run.status]}>
								{run.status}
							</Badge>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<div className="grid grid-cols-2 gap-3">
								<div>
									<p className="text-muted-foreground">Reason</p>
									<p className="font-medium capitalize">
										{formatReason(run.reason)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Tasks Selected</p>
									<p className="font-medium">{run.selectedTaskIds.length}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Iterations</p>
									<p className="font-medium">
										{run.currentIteration} / {run.maxIterations}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Executor</p>
									<p className="font-medium capitalize">{run.executorMode}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Started</p>
									<p className="font-medium">{formatDate(run.startedAt)}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Finished</p>
									<p className="font-medium">{formatDate(run.finishedAt)}</p>
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									variant="secondary"
									size="sm"
									onClick={() => router.push(`/runs/${run.runId}`)}
								>
									View Details
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		);
	};

	return (
		<AppLayout
			title="Run History"
			description="Review previous AI loop executions and their status"
			actions={actions}
			backLink={{ href: "/", label: "Back to Dashboard" }}
		>
			{renderContent()}
		</AppLayout>
	);
}
