"use client";

import { SparkleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { useProjectContext } from "@/components/projects/project-provider";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function AssistantPage() {
	const {
		currentProject,
		loading: projectLoading,
		apiFetch,
	} = useProjectContext();
	const [prompt, setPrompt] = useState("");
	const [generating, setGenerating] = useState(false);

	const handleGenerateTasks = async () => {
		if (!prompt.trim()) {
			toast.error("Please enter a description");
			return;
		}

		if (!currentProject) {
			toast.error("Select a project first");
			return;
		}

		setGenerating(true);
		try {
			const res = await apiFetch("/api/ai/board", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "generate-tasks",
					boardId: "prd",
					data: {
						description: prompt,
						count: 5,
					},
				}),
			});

			if (!res.ok) throw new Error("Failed to generate tasks");

			const data = await res.json();
			toast.success(`Generated ${data.tasks.length} tasks`);
			setPrompt("");
		} catch (error) {
			toast.error("Failed to generate tasks");
			console.error(error);
		} finally {
			setGenerating(false);
		}
	};

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
						Choose a project from the header to generate tasks and insights with
						AI.
					</p>
				</div>
			);
		}

		return (
			<div className="mx-auto space-y-6 max-w-4xl">
				<Card>
					<CardHeader>
						<CardTitle>Generate Tasks from Description</CardTitle>
						<CardDescription>
							Describe a feature or requirement, and AI will generate actionable
							tasks
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Textarea
							placeholder="Example: Build a user authentication system with email/password login, registration, and password reset functionality..."
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							rows={6}
						/>
						<Button onClick={handleGenerateTasks} disabled={generating}>
							<SparkleIcon className="w-4 h-4 mr-2" />
							{generating ? "Generating…" : "Generate Tasks"}
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
						<CardDescription>Common AI-powered operations</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-muted-foreground">
						<p>More AI actions are available directly on sprints and tasks:</p>
						<ul className="list-disc list-inside space-y-1">
							<li>Prioritize tasks based on criteria</li>
							<li>Improve acceptance criteria</li>
							<li>Split tasks into sprints</li>
							<li>Estimate task complexity</li>
							<li>Suggest files to modify</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		);
	};

	return (
		<AppLayout
			title="AI Assistant"
			description="Use AI to generate tasks, improve planning, and more"
			backLink={{ href: "/project", label: "Back to Project" }}
		>
			{renderContent()}
		</AppLayout>
	);
}
