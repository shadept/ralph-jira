"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnsiLog } from "@/components/ansi-log";
import { PageHeader } from "@/components/layout/page-header";
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
import { LocalDateTime } from "@/components/ui/local-date";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RunRecord } from "@/lib/schemas";

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

const formatReason = (reason?: string | null) => {
	if (!reason) return "—";
	return reason.replace(/_/g, " ");
};

const escapeForDisplay = (arg: string) => {
	if (typeof arg !== "string") return `${arg}`;
	if (arg.length === 0) return '""';
	if (/[ \t\n\r"']/.test(arg)) {
		return `"${arg.replace(/"/g, '\\"')}"`;
	}
	return arg;
};

export default function RunDetailPage({
	params,
}: {
	params: Promise<{ runId: string }>;
}) {
	const { runId } = use(params);
	const router = useRouter();
	const { currentProject, apiFetch } = useProjectContext();
	const [run, setRun] = useState<RunRecord | null>(null);
	const [logLines, setLogLines] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const logEndRef = useRef<HTMLDivElement>(null);

	const loadRun = useCallback(async () => {
		if (!currentProject) {
			setRun(null);
			setLogLines([]);
			setLoading(false);
			return;
		}
		setRefreshing(true);
		try {
			const res = await apiFetch(`/api/runs/${runId}?tail=200`);
			const data = await res.json();
			setRun(data.run);
			setLogLines(data.log || []);
		} catch (error) {
			console.error("Failed to load run details", error);
			toast.error("Failed to load run details");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [apiFetch, currentProject, runId]);

	useEffect(() => {
		loadRun();
	}, [loadRun]);

	// Auto-refresh when run is active
	useEffect(() => {
		if (!run || !["running", "queued"].includes(run.status)) return;
		const interval = setInterval(loadRun, 5000);
		return () => clearInterval(interval);
	}, [run?.status, loadRun, run]);

	// Scroll log to bottom after data loads
	useEffect(() => {
		if (logLines.length > 0 && logEndRef.current) {
			logEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [logLines]);

	const handleCancel = async () => {
		if (!run) return;
		try {
			await apiFetch(`/api/runs/${run.runId}/cancel`, { method: "POST" });
			const isForceKill = !!run.cancellationRequestedAt;
			toast.success(isForceKill ? "Process killed" : "Cancellation requested");
			await loadRun();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to cancel run";
			toast.error(message);
			console.error("Cancel run error", error);
		}
	};

	const handleRetry = async () => {
		if (!run) return;
		try {
			await apiFetch(`/api/runs/${run.runId}/retry`, { method: "POST" });
			toast.success("Run restarted");
			await loadRun();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to retry run";
			toast.error(message);
			console.error("Retry run error", error);
		}
	};

	const viewSprint = () => {
		if (!run) return;
		router.push(`/project/sprints/${run.sprintId}`);
	};

	const actions = run ? (
		<div className="flex flex-wrap gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={loadRun}
				disabled={refreshing}
			>
				Refresh
			</Button>
			<Button variant="outline" size="sm" onClick={viewSprint}>
				Open Sprint
			</Button>
			{["failed", "stopped", "completed", "canceled"].includes(run.status) && (
				<Button variant="default" size="sm" onClick={handleRetry}>
					Retry Run
				</Button>
			)}
			<Button
				variant="destructive"
				size="sm"
				onClick={handleCancel}
				disabled={!["running", "queued"].includes(run.status)}
			>
				{run.cancellationRequestedAt ? "Force Kill" : "Cancel Run"}
			</Button>
		</div>
	) : undefined;

	const renderContent = () => {
		if (!currentProject) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">No project selected</p>
					<p className="text-sm text-muted-foreground max-w-md">
						Use the project picker to choose a workspace before viewing run
						details.
					</p>
				</div>
			);
		}

		if (loading) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading run…</p>
				</div>
			);
		}

		if (!run) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">Run not found</p>
					<p className="text-sm text-muted-foreground max-w-md">
						The requested run ID does not exist for this project.
					</p>
				</div>
			);
		}

		return (
			<div className="space-y-6">
				<Card>
					<CardHeader className="flex flex-col gap-2">
						<div className="flex items-start justify-between gap-4">
							<div>
								<CardTitle className="text-lg">
									{run.sprintName || run.sprintId}
								</CardTitle>
								<CardDescription>Run ID: {run.runId}</CardDescription>
							</div>
							<Badge className={RUN_STATUS_STYLES[run.status]}>
								{run.status}
							</Badge>
						</div>
						<p className="text-sm text-muted-foreground">
							Reason: {formatReason(run.reason)}
						</p>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						<div className="grid grid-cols-2 gap-4">
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
								<p className="text-muted-foreground">PID</p>
								<p className="font-medium font-mono">{run.pid ?? "—"}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Branch</p>
								<p className="font-medium break-words">
									{run.sandboxBranch || "—"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Created</p>
								<p className="font-medium">
									<LocalDateTime date={run.createdAt} fallback="—" />
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Started</p>
								<p className="font-medium">
									<LocalDateTime date={run.startedAt} fallback="—" />
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Finished</p>
								<p className="font-medium">
									<LocalDateTime date={run.finishedAt} fallback="—" />
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Last Task</p>
								<p className="font-medium">{run.lastTaskId || "—"}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Last Command</p>
								<p className="font-medium break-words">
									{run.lastCommand || "—"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Exit Code</p>
								<p className="font-medium">{run.lastCommandExitCode ?? "—"}</p>
							</div>
						</div>
						<div>
							<p className="text-muted-foreground">Selected Tasks</p>
							{run.selectedTaskIds.length ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{run.selectedTaskIds.map((taskId) => (
										<Badge key={taskId} variant="secondary">
											{taskId}
										</Badge>
									))}
								</div>
							) : (
								<p className="font-medium">—</p>
							)}
						</div>
						<div>
							<p className="text-muted-foreground">Last Message</p>
							<p className="font-medium break-words">
								{run.lastMessage || "—"}
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Command History</CardTitle>
						<CardDescription>
							All commands executed during this run
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-64 rounded-md border p-4">
							{run.commands && run.commands.length > 0 ? (
								<div className="space-y-4">
									{run.commands.map((cmd, idx) => (
										<div
											key={idx}
											className="border-b pb-2 last:border-0 last:pb-0"
										>
											<div className="flex items-center justify-between gap-2">
												<code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
													{cmd.command}{" "}
													{cmd.args.map(escapeForDisplay).join(" ")}
												</code>
												<Badge
													variant={
														cmd.exitCode === 0 ? "outline" : "destructive"
													}
												>
													{cmd.exitCode ?? "—"}
												</Badge>
											</div>
											<div className="mt-1 flex gap-4 text-[10px] text-muted-foreground">
												<span>
													Started:{" "}
													<LocalDateTime date={cmd.startedAt} fallback="—" />
												</span>
												{cmd.finishedAt && (
													<span>
														Finished:{" "}
														<LocalDateTime date={cmd.finishedAt} fallback="—" />
													</span>
												)}
												<span>CWD: {cmd.cwd}</span>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									No commands recorded.
								</p>
							)}
						</ScrollArea>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Log Output</CardTitle>
						<CardDescription>
							Last 200 lines from the sandbox progress log
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-96 rounded-md border bg-muted/30 p-4">
							{logLines.length ? (
								<>
									<AnsiLog content={logLines} className="text-xs" />
									<div ref={logEndRef} />
								</>
							) : (
								<p className="text-sm text-muted-foreground">
									No log output recorded.
								</p>
							)}
						</ScrollArea>
					</CardContent>
				</Card>
			</div>
		);
	};

	return (
		<>
			<PageHeader
				title={`Run ${runId}`}
				description="Inspect a single AI loop execution"
				actions={actions}
				backLink={{ href: "/project/runs", label: "Back to Runs" }}
			/>
			{renderContent()}
		</>
	);
}
