"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AnsiLog } from "@/components/ansi-log";
import { PageHeader } from "@/components/layout/page-header";
import { useProjectContext } from "@/components/projects/project-provider";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FilesPage() {
	const { currentProject, apiFetch } = useProjectContext();
	const [progress, setProgress] = useState("");
	const [loading, setLoading] = useState(true);

	const loadProgress = useCallback(async () => {
		if (!currentProject) {
			setProgress("");
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const res = await apiFetch("/api/progress");
			const data = await res.json();
			setProgress(data.progress);
		} catch (error) {
			toast.error("Failed to load progress log");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject]);

	useEffect(() => {
		loadProgress();
	}, [loadProgress]);

	const renderContent = () => {
		if (!currentProject) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">No project selected</p>
					<p className="text-sm text-muted-foreground max-w-md">
						Choose a project from the header to view its planning artifacts and
						progress log.
					</p>
				</div>
			);
		}

		return (
			<Tabs defaultValue="progress" className="space-y-4">
				<TabsList>
					<TabsTrigger value="progress">Progress Log</TabsTrigger>
					<TabsTrigger value="prd">Active Sprint (prd.json)</TabsTrigger>
					<TabsTrigger value="settings">Settings</TabsTrigger>
				</TabsList>

				<TabsContent value="progress">
					<Card>
						<CardHeader>
							<CardTitle>Progress Log</CardTitle>
							<CardDescription>
								Append-only log of AI runner executions
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ScrollArea className="h-[600px] w-full rounded-md border p-4">
								{loading ? (
									<p className="text-sm text-muted-foreground">Loading…</p>
								) : progress ? (
									<AnsiLog content={progress} className="text-sm" />
								) : (
									<p className="text-sm text-muted-foreground">
										No progress logged yet
									</p>
								)}
							</ScrollArea>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="prd">
					<Card>
						<CardHeader>
							<CardTitle>plans/prd.json</CardTitle>
							<CardDescription>The active sprint configuration</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								View and edit the active sprint at{" "}
								<Link
									href="/project/sprints/prd"
									className="text-primary underline"
								>
									/project/sprints/prd
								</Link>
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="settings">
					<Card>
						<CardHeader>
							<CardTitle>plans/settings.json</CardTitle>
							<CardDescription>Project configuration</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								View and edit settings at{" "}
								<Link
									href="/project/settings"
									className="text-primary underline"
								>
									/project/settings
								</Link>
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		);
	};

	return (
		<>
			<PageHeader
				title="Files & Artifacts"
				description="Inspect planning assets, logs, and generated data"
				backLink={{ href: "/project", label: "Back to Project" }}
			/>
			{renderContent()}
		</>
	);
}
