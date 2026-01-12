"use client";

import {
	ArrowClockwiseIcon,
	ArrowRightIcon,
	CheckCircleIcon,
	ListChecksIcon,
	PlusIcon,
	RobotIcon,
	SparkleIcon,
	SpinnerIcon,
	UserIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useProjectContext } from "@/components/projects/project-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Sprint } from "@/lib/schemas";

type SprintLoadState = "idle" | "loading" | "success" | "error";

// Message types for the transcript
type MessageRole = "user" | "assistant";

interface GeneratedTask {
	id: string;
	title: string;
}

interface BaseMessage {
	id: string;
	role: MessageRole;
	timestamp: Date;
}

interface UserMessage extends BaseMessage {
	role: "user";
	content: string;
}

interface AssistantSuccessMessage extends BaseMessage {
	role: "assistant";
	type: "success";
	taskCount: number;
	tasks: GeneratedTask[];
	sprintId: string;
}

interface AssistantErrorMessage extends BaseMessage {
	role: "assistant";
	type: "error";
	error: string;
	errorCode?: string;
	canRetry: boolean;
	retryPayload?: {
		sprintId: string;
		description: string;
	};
}

interface AssistantLoadingMessage extends BaseMessage {
	role: "assistant";
	type: "loading";
}

type AssistantMessage =
	| AssistantSuccessMessage
	| AssistantErrorMessage
	| AssistantLoadingMessage;
type Message = UserMessage | AssistantMessage;

// Suggested prompt chips
const SUGGESTED_PROMPTS = [
	"Build user authentication with email/password login, registration, and password reset",
	"Create a dashboard with analytics charts and data visualization",
	"Implement file upload with drag-and-drop and progress indicators",
];

export default function AssistantPage() {
	const router = useRouter();
	const { currentProject, apiFetch } = useProjectContext();
	const [prompt, setPrompt] = useState("");
	const [generating, setGenerating] = useState(false);

	// Sprint selector state
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [sprintLoadState, setSprintLoadState] =
		useState<SprintLoadState>("idle");
	const [sprintError, setSprintError] = useState<string | null>(null);
	const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

	// Validation state
	const [showSprintValidation, setShowSprintValidation] = useState(false);
	const [showDescriptionValidation, setShowDescriptionValidation] =
		useState(false);

	// Transcript state
	const [messages, setMessages] = useState<Message[]>([]);
	const transcriptEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Scroll to bottom when new messages are added
	useEffect(() => {
		transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

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

	// Reset sprint selection when project changes, but preserve transcript
	useEffect(() => {
		setSelectedSprintId(null);
		setShowSprintValidation(false);
		setShowDescriptionValidation(false);
	}, [currentProject?.id]);

	const handleSprintChange = (value: string) => {
		setSelectedSprintId(value);
		setShowSprintValidation(false);
	};

	const handleRetryLoadSprints = () => {
		loadSprints();
	};

	const handlePromptChipClick = (chipPrompt: string) => {
		setPrompt(chipPrompt);
		setShowDescriptionValidation(false);
		inputRef.current?.focus();
	};

	const generateTasksRequest = async (
		sprintId: string,
		description: string,
		isRetry = false
	): Promise<void> => {
		// Generate unique message IDs
		const userMessageId = `user-${Date.now()}`;
		const assistantMessageId = `assistant-${Date.now()}`;

		// Add user message only if not a retry (retry reuses previous user message context)
		if (!isRetry) {
			const userMessage: UserMessage = {
				id: userMessageId,
				role: "user",
				content: description,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, userMessage]);
		}

		// Add loading message
		const loadingMessage: AssistantLoadingMessage = {
			id: assistantMessageId,
			role: "assistant",
			type: "loading",
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, loadingMessage]);

		setGenerating(true);

		try {
			const res = await apiFetch("/api/ai/sprint/generate-tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sprintId,
					description,
					count: 5,
				}),
			});

			// Remove loading message
			setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));

			if (!res.ok) {
				const errorData = await res.json();
				const errorCode = errorData.code;
				const errorMessage = errorData.error || "Failed to generate tasks";

				const errorAssistantMessage: AssistantErrorMessage = {
					id: `assistant-error-${Date.now()}`,
					role: "assistant",
					type: "error",
					error: errorMessage,
					errorCode,
					canRetry: true,
					retryPayload: { sprintId, description },
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, errorAssistantMessage]);
				return;
			}

			const data = await res.json();
			const tasks: GeneratedTask[] = data.tasks.map(
				(t: { id: string; title: string }) => ({
					id: t.id,
					title: t.title,
				})
			);

			const successMessage: AssistantSuccessMessage = {
				id: `assistant-success-${Date.now()}`,
				role: "assistant",
				type: "success",
				taskCount: tasks.length,
				tasks,
				sprintId,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, successMessage]);

			// Clear input on success
			setPrompt("");
		} catch (error) {
			// Remove loading message
			setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));

			const errorAssistantMessage: AssistantErrorMessage = {
				id: `assistant-error-${Date.now()}`,
				role: "assistant",
				type: "error",
				error:
					error instanceof Error ? error.message : "Failed to generate tasks",
				canRetry: true,
				retryPayload: { sprintId, description },
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, errorAssistantMessage]);
		} finally {
			setGenerating(false);
		}
	};

	const handleGenerateTasks = async () => {
		// Validate sprint selection
		if (!selectedSprintId) {
			setShowSprintValidation(true);
			return;
		}

		// Validate description
		if (!prompt.trim()) {
			setShowDescriptionValidation(true);
			return;
		}

		if (!currentProject) {
			return;
		}

		setShowDescriptionValidation(false);
		await generateTasksRequest(selectedSprintId, prompt.trim());
	};

	const handleRetry = async (retryPayload: {
		sprintId: string;
		description: string;
	}) => {
		// Use the latest selected sprint if available, otherwise use the original
		const sprintIdToUse = selectedSprintId || retryPayload.sprintId;
		await generateTasksRequest(
			sprintIdToUse,
			retryPayload.description,
			true // isRetry
		);
	};

	const renderSprintSelector = () => {
		// Loading state
		if (sprintLoadState === "loading") {
			return (
				<div className="space-y-2">
					<Label htmlFor="sprint-select">Target Sprint</Label>
					<div className="flex items-center gap-2 text-muted-foreground">
						<SpinnerIcon className="w-4 h-4 animate-spin" />
						<span className="text-sm">Loading sprints...</span>
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

	const renderMessage = (message: Message) => {
		if (message.role === "user") {
			return (
				<div key={message.id} className="flex gap-3 justify-end">
					<div className="max-w-[80%] rounded-lg bg-primary text-primary-foreground px-4 py-3">
						<p className="text-sm whitespace-pre-wrap">{message.content}</p>
					</div>
					<div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
						<UserIcon className="w-4 h-4" />
					</div>
				</div>
			);
		}

		// Assistant message
		const assistantMessage = message as AssistantMessage;

		if (assistantMessage.type === "loading") {
			return (
				<div key={message.id} className="flex gap-3">
					<div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
						<RobotIcon className="w-4 h-4 text-primary" />
					</div>
					<div className="max-w-[80%] rounded-lg bg-muted px-4 py-3">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<SpinnerIcon className="w-4 h-4 animate-spin" />
							<span>Generating tasks...</span>
						</div>
					</div>
				</div>
			);
		}

		if (assistantMessage.type === "error") {
			const isSprintNotFound =
				assistantMessage.errorCode === "SPRINT_NOT_FOUND";
			return (
				<div key={message.id} className="flex gap-3">
					<div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
						<RobotIcon className="w-4 h-4 text-destructive" />
					</div>
					<div className="max-w-[80%] rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 space-y-3">
						<div className="flex items-start gap-2">
							<WarningCircleIcon className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
							<div className="space-y-1">
								<p className="text-sm text-destructive font-medium">
									{assistantMessage.error}
								</p>
								{isSprintNotFound && (
									<p className="text-xs text-muted-foreground">
										The selected sprint may have been deleted. Please select a
										different sprint and try again.
									</p>
								)}
							</div>
						</div>
						{assistantMessage.canRetry && assistantMessage.retryPayload && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleRetry(assistantMessage.retryPayload!)}
								disabled={generating || (isSprintNotFound && !selectedSprintId)}
							>
								<ArrowClockwiseIcon className="w-3 h-3 mr-1" />
								{isSprintNotFound ? "Retry with selected sprint" : "Retry"}
							</Button>
						)}
					</div>
				</div>
			);
		}

		// Success message
		const successMessage = assistantMessage as AssistantSuccessMessage;
		return (
			<div key={message.id} className="flex gap-3">
				<div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
					<RobotIcon className="w-4 h-4 text-primary" />
				</div>
				<div className="max-w-[80%] rounded-lg bg-muted px-4 py-3 space-y-3">
					<div className="flex items-center gap-2 text-sm">
						<CheckCircleIcon className="w-4 h-4 text-green-600" />
						<span className="font-medium">
							Created {successMessage.taskCount} task
							{successMessage.taskCount !== 1 ? "s" : ""}
						</span>
					</div>
					{successMessage.tasks.length > 0 && (
						<ul className="text-sm space-y-1 pl-6 list-disc">
							{successMessage.tasks.map((task) => (
								<li key={task.id} className="text-muted-foreground">
									{task.title}
								</li>
							))}
						</ul>
					)}
					<div className="flex flex-wrap gap-2 pt-1">
						<Button variant="outline" size="sm" asChild>
							<Link href={`/project/sprints/${successMessage.sprintId}`}>
								<ArrowRightIcon className="w-3 h-3 mr-1" />
								View Sprint
							</Link>
						</Button>
						<Button variant="outline" size="sm" asChild>
							<Link href="/project/tasks">
								<ListChecksIcon className="w-3 h-3 mr-1" />
								View All Tasks
							</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	};

	const renderPromptChips = () => {
		if (messages.length > 0) return null;

		return (
			<div className="space-y-2">
				<p className="text-sm text-muted-foreground">Try a suggestion:</p>
				<div className="flex flex-wrap gap-2">
					{SUGGESTED_PROMPTS.map((chipPrompt, index) => (
						<button
							key={index}
							type="button"
							onClick={() => handlePromptChipClick(chipPrompt)}
							className={cn(
								"text-left text-sm px-3 py-2 rounded-lg border bg-card",
								"hover:bg-accent hover:border-accent-foreground/20",
								"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
								"transition-colors"
							)}
						>
							{chipPrompt}
						</button>
					))}
				</div>
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
			<div className="mx-auto max-w-4xl flex flex-col h-[calc(100vh-12rem)]">
				{/* Sprint selector at top */}
				<Card className="mb-4">
					<CardContent className="pt-4">{renderSprintSelector()}</CardContent>
				</Card>

				{/* Transcript area */}
				<Card className="flex-1 flex flex-col min-h-0 mb-4">
					<CardContent className="flex-1 flex flex-col min-h-0 p-0">
						<ScrollArea className="flex-1 p-4">
							{messages.length === 0 ? (
								<div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-4">
									<RobotIcon className="w-12 h-12 text-muted-foreground/50" />
									<div className="space-y-1">
										<p className="font-medium">Start a conversation</p>
										<p className="text-sm text-muted-foreground max-w-md">
											Describe a feature or requirement, and I&apos;ll generate
											actionable tasks for your sprint.
										</p>
									</div>
									{renderPromptChips()}
								</div>
							) : (
								<div className="space-y-4">
									{messages.map(renderMessage)}
									<div ref={transcriptEndRef} />
								</div>
							)}
						</ScrollArea>
					</CardContent>
				</Card>

				{/* Input area */}
				<Card>
					<CardContent className="pt-4 space-y-3">
						<div className="space-y-2">
							<Label htmlFor="task-description">
								Describe what you want to build
							</Label>
							<Textarea
								ref={inputRef}
								id="task-description"
								placeholder="Example: Build a user authentication system with email/password login, registration, and password reset functionality..."
								value={prompt}
								onChange={(e) => {
									setPrompt(e.target.value);
									setShowDescriptionValidation(false);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
										e.preventDefault();
										handleGenerateTasks();
									}
								}}
								rows={3}
								className={
									showDescriptionValidation && !prompt.trim()
										? "border-destructive"
										: ""
								}
								aria-invalid={showDescriptionValidation && !prompt.trim()}
								aria-describedby={
									showDescriptionValidation && !prompt.trim()
										? "description-validation-error"
										: undefined
								}
							/>
							{showDescriptionValidation && !prompt.trim() && (
								<p
									id="description-validation-error"
									className="text-sm text-destructive flex items-center gap-1"
									role="alert"
								>
									<WarningCircleIcon className="w-3 h-3" />
									Please enter a description of what you want to build
								</p>
							)}
						</div>
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground">
								Press{" "}
								<kbd className="px-1 py-0.5 bg-muted rounded text-xs">
									Ctrl+Enter
								</kbd>{" "}
								to send
							</p>
							<Button
								onClick={handleGenerateTasks}
								disabled={isGenerateDisabled}
							>
								<SparkleIcon className="w-4 h-4 mr-2" />
								{generating ? "Generating..." : "Generate Tasks"}
							</Button>
						</div>
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
