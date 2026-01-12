"use client";

import {
	ArrowClockwiseIcon,
	PlusIcon,
	SparkleIcon,
	SpinnerIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { useProjectContext } from "@/components/projects/project-provider";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Sprint } from "@/lib/schemas";

type SprintLoadState = "idle" | "loading" | "success" | "error";

export default function AssistantPage() {
	const router = useRouter();
	const { currentProject, apiFetch } = useProjectContext();
	const [prompt, setPrompt] = useState("");
	const [generating, setGenerating] = useState(false);

	// Sprint selector state
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [sprintLoadState, setSprintLoadState] = useState<SprintLoadState>("idle");
	const [sprintError, setSprintError] = useState<string | null>(null);
	const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

	// Validation state
	const [showSprintValidation, setShowSprintValidation] = useState(false);

	// Load sprints when project is selected
	const loadSprints = useCallback(async () => {
		if (!currentProject) {
			setSprints([]);
			setSprintLoadState("idle");
			setSelectedSprintId(null);
			return;
		}

		setSprintLoadState("loading");
		setSprintError(null);

		try {
			const res = await apiFetch("/api/sprints");
			const data = await res.json();
			const loadedSprints = data.sprints || [];
			setSprints(loadedSprints);
			setSprintLoadState("success");

			// Auto-select first sprint if available and none selected
			if (loadedSprints.length > 0 && !selectedSprintId) {
				setSelectedSprintId(loadedSprints[0].id);
			}
		} catch (error) {
			console.error("Failed to load sprints:", error);
			setSprintError(
				error instanceof Error ? error.message : "Failed to load sprints"
			);
			setSprintLoadState("error");
			setSprints([]);
		}
	}, [apiFetch, currentProject, selectedSprintId]);

	useEffect(() => {
		loadSprints();
	}, [loadSprints]);

	// Reset sprint selection when project changes
	useEffect(() => {
		setSelectedSprintId(null);
		setShowSprintValidation(false);
	}, [currentProject?.id]);

	const handleSprintChange = (value: string) => {
		setSelectedSprintId(value);
		setShowSprintValidation(false);
	};

	const handleRetryLoadSprints = () => {
		loadSprints();
	};

	const handleGenerateTasks = async () => {
		// Validate sprint selection
		if (!selectedSprintId) {
			setShowSprintValidation(true);
			return;
		}

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
			const res = await apiFetch("/api/ai/sprint/generate-tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sprintId: selectedSprintId,
					description: prompt,
					count: 5,
				}),
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || "Failed to generate tasks");
			}

			const data = await res.json();
			toast.success(`Generated ${data.tasks.length} tasks`);
			setPrompt("");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to generate tasks"
			);
			console.error(error);
		} finally {
			setGenerating(false);
		}
	};

	const renderSprintSelector = () => {
		// Loading state
		if (sprintLoadState === "loading") {
			return (
				<div className="space-y-2">
					<Label htmlFor="sprint-select">Target Sprint</Label>
					<div className="flex items-center gap-2 text-muted-foreground">
						<SpinnerIcon className="w-4 h-4 animate-spin" />
						<span className="text-sm">Loading sprints…</span>
					</div>
				</div>
			);
		}

		// Error state
		if (sprintLoadState === "error") {
			return (
				<div className="space-y-2">
					<Label htmlFor="sprint-select">Target Sprint</Label>
					<div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
						<WarningCircleIcon className="w-4 h-4 text-destructive flex-shrink-0" />
						<span className="text-sm text-destructive flex-1">
							{sprintError || "Failed to load sprints"}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={handleRetryLoadSprints}
							className="flex-shrink-0"
						>
							<ArrowClockwiseIcon className="w-3 h-3 mr-1" />
							Retry
						</Button>
					</div>
				</div>
			);
		}

		// Empty state - no sprints found
		if (sprintLoadState === "success" && sprints.length === 0) {
			return (
				<div className="space-y-2">
					<Label htmlFor="sprint-select">Target Sprint</Label>
					<div className="flex flex-col gap-2 p-3 rounded-md bg-muted/50 border">
						<span className="text-sm text-muted-foreground">
							No sprints found. Create a sprint first to generate tasks.
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => router.push("/project")}
							className="w-fit"
						>
							<PlusIcon className="w-3 h-3 mr-1" />
							Create Sprint
						</Button>
					</div>
				</div>
			);
		}

		// Success state with sprints
		return (
			<div className="space-y-2">
				<Label htmlFor="sprint-select">Target Sprint</Label>
				<Select
					value={selectedSprintId || ""}
					onValueChange={handleSprintChange}
				>
					<SelectTrigger
						id="sprint-select"
						className={`w-full ${showSprintValidation && !selectedSprintId ? "border-destructive" : ""}`}
						aria-invalid={showSprintValidation && !selectedSprintId}
						aria-describedby={
							showSprintValidation && !selectedSprintId
								? "sprint-validation-error"
								: undefined
						}
					>
						<SelectValue placeholder="Select a sprint" />
					</SelectTrigger>
					<SelectContent>
						{sprints.map((sprint) => (
							<SelectItem key={sprint.id} value={sprint.id}>
								{sprint.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{showSprintValidation && !selectedSprintId && (
					<p
						id="sprint-validation-error"
						className="text-sm text-destructive flex items-center gap-1"
						role="alert"
					>
						<WarningCircleIcon className="w-3 h-3" />
						Please select a sprint before generating tasks
					</p>
				)}
			</div>
		);
	};

	const isGenerateDisabled =
		generating ||
		sprintLoadState === "loading" ||
		sprintLoadState === "error" ||
		sprints.length === 0;

	const renderContent = () => {
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
						{renderSprintSelector()}
						<div className="space-y-2">
							<Label htmlFor="task-description">Description</Label>
							<Textarea
								id="task-description"
								placeholder="Example: Build a user authentication system with email/password login, registration, and password reset functionality..."
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								rows={6}
							/>
						</div>
						<Button onClick={handleGenerateTasks} disabled={isGenerateDisabled}>
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
		<>
			<PageHeader
				title="AI Chat"
				description="Use AI to generate tasks, improve planning, and more"
				backLink={{ href: "/project", label: "Back to Project" }}
			/>
			{renderContent()}
		</>
	);
}
