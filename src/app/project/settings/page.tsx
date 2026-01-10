"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FloppyDiskIcon, FolderOpen, GithubLogo } from "@phosphor-icons/react";
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
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ProjectSettings,
	CLAUDE_MODELS,
	CLAUDE_PERMISSION_MODES,
	DEFAULT_CLAUDE_MODEL,
	DEFAULT_CLAUDE_PERMISSION_MODE,
	DEFAULT_AUTOMATION_SETTINGS,
	ensureAgentDefaults,
	ensureAutomationDefaults,
	withAutomationDefaults,
	isKnownClaudeModel,
} from "@/lib/schemas";

type OpencodeModelsState = {
	status: "idle" | "loading" | "success" | "error";
	data: string[];
	error: string | null;
};

type FormValues = {
	projectName: string;
	projectDescription: string;
	techStack: string;
	setupCommands: string;
	agentName: "claude" | "opencode";
	agentModel: string;
	permissionMode: string;
	maxIterations: number;
	extraArgs: string;
	codingStyle: string;
	testCommands: string;
	testNotes: string;
	runCommands: string;
	runNotes: string;
	aiModel: string;
	aiProvider: string;
	guardrails: string;
};

function settingsToFormValues(settings: ProjectSettings): FormValues {
	const automation = ensureAutomationDefaults(settings.automation);
	const agent = ensureAgentDefaults(automation.agent);

	return {
		projectName: settings.projectName,
		projectDescription: settings.projectDescription,
		techStack: (settings.techStack ?? []).join(", "),
		setupCommands: automation.setup.join("\n"),
		agentName: agent.name,
		agentModel: agent.model ?? "",
		permissionMode: agent.permissionMode ?? DEFAULT_CLAUDE_PERMISSION_MODE,
		maxIterations: automation.maxIterations,
		extraArgs: (agent.extraArgs ?? []).join("\n"),
		codingStyle: automation.codingStyle,
		testCommands: (settings.howToTest?.commands ?? []).join("\n"),
		testNotes: settings.howToTest?.notes ?? "",
		runCommands: (settings.howToRun?.commands ?? []).join("\n"),
		runNotes: settings.howToRun?.notes ?? "",
		aiModel: settings.aiPreferences?.defaultModel ?? "",
		aiProvider: settings.aiPreferences?.provider ?? "",
		guardrails: (settings.aiPreferences?.guardrails ?? []).join("\n"),
	};
}

function formValuesToSettings(
	values: FormValues,
	existingSettings: ProjectSettings
): ProjectSettings {
	const parseLines = (text: string) =>
		text
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

	const parseCommas = (text: string) =>
		text
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

	return {
		projectName: values.projectName,
		projectDescription: values.projectDescription,
		techStack: parseCommas(values.techStack),
		automation: {
			setup: parseLines(values.setupCommands),
			maxIterations: values.maxIterations,
			codingStyle: values.codingStyle,
			agent: {
				name: values.agentName,
				model: values.agentModel || undefined,
				permissionMode:
					values.agentName === "claude" ? values.permissionMode : undefined,
				extraArgs: parseLines(values.extraArgs),
			},
		},
		howToTest: {
			commands: parseLines(values.testCommands),
			notes: values.testNotes,
		},
		howToRun: {
			commands: parseLines(values.runCommands),
			notes: values.runNotes,
		},
		aiPreferences: {
			defaultModel: values.aiModel,
			provider: values.aiProvider,
			guardrails: parseLines(values.guardrails),
		},
		repoConventions: existingSettings.repoConventions,
	};
}

function SettingsForm({
	initialSettings,
	onSave,
	saving,
	opencodeModelsState,
	loadOpencodeModels,
}: {
	initialSettings: ProjectSettings;
	onSave: (settings: ProjectSettings) => Promise<void>;
	saving: boolean;
	opencodeModelsState: OpencodeModelsState;
	loadOpencodeModels: () => void;
}) {
	const form = useForm({
		defaultValues: settingsToFormValues(initialSettings),
		onSubmit: async ({ value }) => {
			await onSave(formValuesToSettings(value, initialSettings));
		},
	});

	const agentName = useStore(form.store, (state) => state.values.agentName);

	useEffect(() => {
		if (agentName === "opencode" && opencodeModelsState.status === "idle") {
			loadOpencodeModels();
		}
	}, [agentName, opencodeModelsState.status, loadOpencodeModels]);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<Card>
				<CardHeader>
					<CardTitle>Project Information</CardTitle>
					<CardDescription>Basic project details</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form.Field name="projectName">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Project Name</Label>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="projectDescription">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Description</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={3}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="techStack">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Tech Stack (comma-separated)</Label>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Automation</CardTitle>
					<CardDescription>
						Runner setup commands and agent configuration
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form.Field name="setupCommands">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Setup Commands (one per line)</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={3}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<form.Field name="agentName">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Runner Agent</Label>
									<Select
										value={field.state.value}
										onValueChange={(value) => {
											field.handleChange(value as "claude" | "opencode");
											if (value === "claude") {
												const currentModel = form.getFieldValue("agentModel");
												if (!isKnownClaudeModel(currentModel)) {
													form.setFieldValue("agentModel", DEFAULT_CLAUDE_MODEL);
												}
												form.setFieldValue(
													"permissionMode",
													form.getFieldValue("permissionMode") ||
														DEFAULT_CLAUDE_PERMISSION_MODE
												);
											}
										}}
									>
										<SelectTrigger id={field.name} className="mt-1 w-full">
											<SelectValue placeholder="Select agent" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="claude">Claude</SelectItem>
											<SelectItem value="opencode">OpenCode</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}
						</form.Field>

						<form.Field name="maxIterations">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Max Iterations</Label>
									<Input
										id={field.name}
										type="number"
										min={1}
										max={10}
										value={field.state.value}
										onChange={(e) => {
											const parsed = parseInt(e.target.value, 10);
											const sanitized = Number.isNaN(parsed)
												? DEFAULT_AUTOMATION_SETTINGS.maxIterations
												: Math.min(Math.max(parsed, 1), 10);
											field.handleChange(sanitized);
										}}
										className="mt-1"
									/>
								</div>
							)}
						</form.Field>
					</div>

					{agentName === "claude" && (
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<form.Field name="agentModel">
								{(field) => (
									<div>
										<Label htmlFor={field.name}>Agent Model</Label>
										<Select
											value={
												isKnownClaudeModel(field.state.value)
													? field.state.value
													: DEFAULT_CLAUDE_MODEL
											}
											onValueChange={(value) =>
												field.handleChange(value || DEFAULT_CLAUDE_MODEL)
											}
										>
											<SelectTrigger id={field.name} className="mt-1 w-full">
												<SelectValue placeholder="Select model" />
											</SelectTrigger>
											<SelectContent>
												{CLAUDE_MODELS.map((model) => (
													<SelectItem key={model} value={model}>
														{model}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>

							<form.Field name="permissionMode">
								{(field) => (
									<div>
										<Label htmlFor={field.name}>Permission Mode</Label>
										<Select
											value={field.state.value || DEFAULT_CLAUDE_PERMISSION_MODE}
											onValueChange={(value) => field.handleChange(value)}
										>
											<SelectTrigger id={field.name} className="mt-1 w-full">
												<SelectValue placeholder="Select permission mode" />
											</SelectTrigger>
											<SelectContent>
												{CLAUDE_PERMISSION_MODES.map((mode) => (
													<SelectItem key={mode} value={mode}>
														{mode}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
						</div>
					)}

					{agentName === "opencode" && (
						<form.Field name="agentModel">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Agent Model</Label>
									{opencodeModelsState.status === "error" ? (
										<>
											<Input
												id={field.name}
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value.trim())}
												className="mt-1 w-full"
												placeholder="Enter model ID"
											/>
											<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-destructive">
												<span>
													{opencodeModelsState.error ??
														"Failed to load OpenCode models."}
												</span>
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={loadOpencodeModels}
												>
													Retry
												</Button>
											</div>
										</>
									) : (
										<>
											<Combobox
												items={opencodeModelsState.data}
												value={field.state.value || null}
												onValueChange={(value) =>
													field.handleChange(value ?? "")
												}
												filter={(item, query) =>
													`${item}`.toLowerCase().includes(query.toLowerCase())
												}
											>
												<ComboboxInput
													id={field.name}
													placeholder="Search for a model"
													className="mt-1 !w-full"
													showClear
													disabled={
														opencodeModelsState.status === "loading" &&
														!opencodeModelsState.data.length
													}
												/>
												<ComboboxContent>
													<ComboboxEmpty>
														{opencodeModelsState.status === "loading" &&
														!opencodeModelsState.data.length
															? "Loading models…"
															: "No models found."}
													</ComboboxEmpty>
													<ComboboxList>
														{(model: string) => (
															<ComboboxItem key={model} value={model}>
																{model}
															</ComboboxItem>
														)}
													</ComboboxList>
												</ComboboxContent>
											</Combobox>
											<p className="mt-2 text-xs text-muted-foreground">
												Model list is cached on the server and refreshes when it
												restarts.
											</p>
										</>
									)}
								</div>
							)}
						</form.Field>
					)}

					<form.Field name="extraArgs">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Extra CLI Args (one per line)</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={3}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="codingStyle">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Coding Style Guidance</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={4}
									className="mt-1"
									placeholder="Document lint rules, formatting, or architecture tips"
								/>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Testing Configuration</CardTitle>
					<CardDescription>How to run tests</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form.Field name="testCommands">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Test Commands (one per line)</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={3}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="testNotes">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Testing Notes</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={2}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Run Configuration</CardTitle>
					<CardDescription>How to run the application</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form.Field name="runCommands">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Run Commands (one per line)</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={3}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="runNotes">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Run Notes</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={2}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>AI Preferences</CardTitle>
					<CardDescription>Configure AI behavior</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<form.Field name="aiModel">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Default Model</Label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										className="mt-1"
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="aiProvider">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Provider</Label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										className="mt-1"
									/>
								</div>
							)}
						</form.Field>
					</div>

					<form.Field name="guardrails">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Guardrails (one per line)</Label>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={4}
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button type="submit" disabled={saving}>
					<FloppyDiskIcon className="w-4 h-4 mr-2" />
					{saving ? "Saving…" : "Save Settings"}
				</Button>
			</div>
		</form>
	);
}

function RepoSetupCard({
	onSave,
	saving,
}: {
	onSave: (repoUrl: string) => Promise<void>;
	saving: boolean;
}) {
	const form = useForm({
		defaultValues: {
			repoUrl: "",
		},
		onSubmit: async ({ value }) => {
			if (!value.repoUrl.trim()) {
				toast.error("Please enter a repository path");
				return;
			}
			await onSave(value.repoUrl.trim());
		},
	});

	return (
		<Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
			<CardHeader>
				<div className="flex items-center gap-2">
					<FolderOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
					<CardTitle className="text-amber-900 dark:text-amber-100">
						Repository Setup Required
					</CardTitle>
				</div>
				<CardDescription className="text-amber-800 dark:text-amber-200">
					Connect this project to a local repository to enable AI automation
					features.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="repoUrl">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Repository Path</Label>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="C:\\Projects\\my-app or /home/user/projects/my-app"
									className="font-mono text-sm"
								/>
								<p className="text-xs text-muted-foreground">
									Enter the absolute path to your local git repository. In the
									future, you'll be able to connect via GitHub.
								</p>
							</div>
						)}
					</form.Field>
					<div className="flex items-center gap-3">
						<Button type="submit" disabled={saving}>
							{saving ? "Saving…" : "Set Repository"}
						</Button>
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<GithubLogo className="h-4 w-4" />
							<span>GitHub integration coming soon</span>
						</div>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

export default function SettingsPage() {
	const {
		currentProject,
		loading: projectLoading,
		apiFetch,
		refreshProjects,
	} = useProjectContext();
	const [settings, setSettings] = useState<ProjectSettings | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [opencodeModelsState, setOpencodeModelsState] =
		useState<OpencodeModelsState>({
			status: "idle",
			data: [],
			error: null,
		});
	const [savingRepo, setSavingRepo] = useState(false);

	const loadSettings = useCallback(async () => {
		if (!currentProject) {
			setSettings(null);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const res = await apiFetch("/api/settings");
			const data = await res.json();
			setSettings(withAutomationDefaults(data.settings));
		} catch (error) {
			toast.error("Failed to load settings");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, [apiFetch, currentProject]);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	const loadOpencodeModels = useCallback(async () => {
		setOpencodeModelsState((prev) => ({
			...prev,
			status: "loading",
			error: null,
		}));
		try {
			const res = await apiFetch("/api/opencode/models");
			const data = await res.json();
			const models = Array.isArray(data.models)
				? data.models.map((model: unknown) => `${model}`.trim()).filter(Boolean)
				: [];
			setOpencodeModelsState({ status: "success", data: models, error: null });
		} catch (error) {
			console.error("Failed to load opencode models", error);
			setOpencodeModelsState((prev) => ({
				...prev,
				status: "error",
				error:
					error instanceof Error
						? error.message
						: "Failed to load opencode models",
			}));
		}
	}, [apiFetch]);

	const handleSave = async (newSettings: ProjectSettings) => {
		if (!currentProject) return;

		setSaving(true);
		try {
			await apiFetch("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newSettings),
			});

			setSettings(newSettings);
			await refreshProjects();
			toast.success("Settings saved");
		} catch (error) {
			toast.error("Failed to save settings");
			console.error(error);
		} finally {
			setSaving(false);
		}
	};

	const handleSaveRepoUrl = async (repoUrl: string) => {
		if (!currentProject) return;

		setSavingRepo(true);
		try {
			await fetch(`/api/projects/${currentProject.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ repoUrl }),
			});

			await refreshProjects();
			toast.success("Repository path saved");
		} catch (error) {
			toast.error("Failed to save repository path");
			console.error(error);
		} finally {
			setSavingRepo(false);
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
						Select or create a project from the header to manage its settings.
					</p>
				</div>
			);
		}

		if (loading || !settings) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading settings…</p>
				</div>
			);
		}

		const needsRepoSetup = !currentProject.path;

		return (
			<div className="space-y-6">
				{needsRepoSetup && (
					<RepoSetupCard onSave={handleSaveRepoUrl} saving={savingRepo} />
				)}
				<SettingsForm
					key={currentProject.id}
					initialSettings={settings}
					onSave={handleSave}
					saving={saving}
					opencodeModelsState={opencodeModelsState}
					loadOpencodeModels={loadOpencodeModels}
				/>
			</div>
		);
	};

	return (
		<AppLayout
			title="Project Settings"
			description="Configure project defaults and AI automation preferences"
			backLink={{ href: "/project", label: "Back to Project" }}
		>
			{renderContent()}
		</AppLayout>
	);
}
