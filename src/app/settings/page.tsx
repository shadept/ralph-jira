"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FloppyDiskIcon } from "@phosphor-icons/react";
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
	AutomationSettings,
	ProjectSettings,
	AgentAutomationSettings,
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

export default function SettingsPage() {
	const {
		currentProject,
		loading: projectLoading,
		apiFetch,
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

	const activeAgentName = useMemo(() => {
		if (!settings) return null;
		const automationWithDefaults = ensureAutomationDefaults(
			settings.automation,
		);
		const agentWithDefaults = ensureAgentDefaults(automationWithDefaults.agent);
		return agentWithDefaults.name;
	}, [settings]);

	useEffect(() => {
		if (activeAgentName !== "opencode") {
			return;
		}
		if (opencodeModelsState.status === "idle") {
			loadOpencodeModels();
		}
	}, [activeAgentName, loadOpencodeModels, opencodeModelsState.status]);

	const handleSave = async () => {
		if (!settings || !currentProject) return;

		setSaving(true);
		try {
			await apiFetch("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings),
			});

			toast.success("Settings saved");
		} catch (error) {
			toast.error("Failed to save settings");
			console.error(error);
		} finally {
			setSaving(false);
		}
	};

	const updateAutomation = (
		updater: (automation: AutomationSettings) => AutomationSettings,
	) => {
		setSettings((prev) => {
			if (!prev) return prev;
			const normalized = ensureAutomationDefaults(prev.automation);
			const updated = updater(normalized);
			return { ...prev, automation: ensureAutomationDefaults(updated) };
		});
	};

	const updateAgent = (
		updater: (agent: AgentAutomationSettings) => AgentAutomationSettings,
	) => {
		updateAutomation((current) => ({
			...current,
			agent: updater(ensureAgentDefaults(current.agent)),
		}));
	};

	const canSave = Boolean(settings && currentProject);

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

		const automation = ensureAutomationDefaults(settings.automation);
		const agent = ensureAgentDefaults(automation.agent);

		return (
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Project Information</CardTitle>
						<CardDescription>Basic project details</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label htmlFor="projectName">Project Name</Label>
							<Input
								id="projectName"
								value={settings.projectName}
								onChange={(e) =>
									setSettings({ ...settings, projectName: e.target.value })
								}
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="projectDescription">Description</Label>
							<Textarea
								id="projectDescription"
								value={settings.projectDescription}
								onChange={(e) =>
									setSettings({
										...settings,
										projectDescription: e.target.value,
									})
								}
								rows={3}
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="techStack">Tech Stack (comma-separated)</Label>
							<Input
								id="techStack"
								value={settings.techStack.join(", ")}
								onChange={(e) =>
									setSettings({
										...settings,
										techStack: e.target.value
											.split(",")
											.map((s) => s.trim())
											.filter(Boolean),
									})
								}
								className="mt-1"
							/>
						</div>
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
						<div>
							<Label htmlFor="setupCommands">
								Setup Commands (one per line)
							</Label>
							<Textarea
								id="setupCommands"
								value={automation.setup.join("\n")}
								onChange={(e) => {
									const commands = e.target.value
										.split("\n")
										.map((line) => line.trim())
										.filter(Boolean);
									updateAutomation((current) => ({
										...current,
										setup: commands,
									}));
								}}
								rows={3}
								className="mt-1"
							/>
						</div>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<Label htmlFor="agentName">Runner Agent</Label>
								<Select
									value={agent.name}
									onValueChange={(value) =>
										updateAgent((current) => {
											const nextName = value as AgentAutomationSettings["name"];
											if (nextName === "claude") {
												const nextModel = isKnownClaudeModel(current.model)
													? current.model
													: DEFAULT_CLAUDE_MODEL;
												return {
													...current,
													name: nextName,
													model: nextModel,
													permissionMode:
														current.permissionMode ??
														DEFAULT_CLAUDE_PERMISSION_MODE,
												};
											}
											return {
												...current,
												name: nextName,
												model: undefined,
												permissionMode: undefined,
											};
										})
									}
								>
									<SelectTrigger id="agentName" className="mt-1 w-full">
										<SelectValue placeholder="Select agent" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="claude">Claude</SelectItem>
										<SelectItem value="opencode">OpenCode</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="maxIterations">Max Iterations</Label>
								<Input
									id="maxIterations"
									type="number"
									min={1}
									max={10}
									value={automation.maxIterations}
									onChange={(e) => {
										const parsed = parseInt(e.target.value, 10);
										const sanitized = Number.isNaN(parsed)
											? DEFAULT_AUTOMATION_SETTINGS.maxIterations
											: Math.min(Math.max(parsed, 1), 10);
										updateAutomation((current) => ({
											...current,
											maxIterations: sanitized,
										}));
									}}
									className="mt-1"
								/>
							</div>
						</div>
						{agent.name === "claude" && (
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div>
									<Label htmlFor="agentModel">Agent Model</Label>
									<Select
										value={
											isKnownClaudeModel(agent.model)
												? agent.model
												: DEFAULT_CLAUDE_MODEL
										}
										onValueChange={(value) =>
											updateAgent((current) => ({
												...current,
												model: value || DEFAULT_CLAUDE_MODEL,
											}))
										}
									>
										<SelectTrigger id="agentModel" className="mt-1 w-full">
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
								<div>
									<Label htmlFor="permissionMode">Permission Mode</Label>
									<Select
										value={
											agent.permissionMode ?? DEFAULT_CLAUDE_PERMISSION_MODE
										}
										onValueChange={(value) =>
											updateAgent((current) => ({
												...current,
												permissionMode: value,
											}))
										}
									>
										<SelectTrigger id="permissionMode" className="mt-1 w-full">
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
							</div>
						)}
						{agent.name === "opencode" && (
							<div>
								<Label htmlFor="agentModel">Agent Model</Label>
								{opencodeModelsState.status === "error" ? (
									<>
										<Input
											id="agentModel"
											value={agent.model ?? ""}
											onChange={(e) => {
												const value = e.target.value.trim();
												updateAgent((current) => ({
													...current,
													model: value || undefined,
												}));
											}}
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
											value={agent.model ?? null}
											onValueChange={(value) =>
												updateAgent((current) => ({
													...current,
													model: value ?? undefined,
												}))
											}
											filter={(item, query) =>
												`${item}`.toLowerCase().includes(query.toLowerCase())
											}
										>
											<ComboboxInput
												id="agentModel"
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
						<div>
							<Label htmlFor="agentExtraArgs">
								Extra CLI Args (one per line)
							</Label>
							<Textarea
								id="agentExtraArgs"
								value={(agent.extraArgs ?? []).join("\n")}
								onChange={(e) => {
									const args = e.target.value
										.split("\n")
										.map((line) => line.trim())
										.filter(Boolean);
									updateAgent((current) => ({ ...current, extraArgs: args }));
								}}
								rows={3}
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="codingStyle">Coding Style Guidance</Label>
							<Textarea
								id="codingStyle"
								value={automation.codingStyle}
								onChange={(e) =>
									updateAutomation((current) => ({
										...current,
										codingStyle: e.target.value,
									}))
								}
								rows={4}
								className="mt-1"
								placeholder="Document lint rules, formatting, or architecture tips"
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Testing Configuration</CardTitle>
						<CardDescription>How to run tests</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label htmlFor="testCommands">Test Commands (one per line)</Label>
							<Textarea
								id="testCommands"
								value={settings.howToTest.commands.join("\n")}
								onChange={(e) =>
									setSettings({
										...settings,
										howToTest: {
											...settings.howToTest,
											commands: e.target.value.split("\n").filter(Boolean),
										},
									})
								}
								rows={3}
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="testNotes">Testing Notes</Label>
							<Textarea
								id="testNotes"
								value={settings.howToTest.notes}
								onChange={(e) =>
									setSettings({
										...settings,
										howToTest: {
											...settings.howToTest,
											notes: e.target.value,
										},
									})
								}
								rows={2}
								className="mt-1"
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Run Configuration</CardTitle>
						<CardDescription>How to run the application</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label htmlFor="runCommands">Run Commands (one per line)</Label>
							<Textarea
								id="runCommands"
								value={settings.howToRun.commands.join("\n")}
								onChange={(e) =>
									setSettings({
										...settings,
										howToRun: {
											...settings.howToRun,
											commands: e.target.value.split("\n").filter(Boolean),
										},
									})
								}
								rows={3}
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="runNotes">Run Notes</Label>
							<Textarea
								id="runNotes"
								value={settings.howToRun.notes}
								onChange={(e) =>
									setSettings({
										...settings,
										howToRun: {
											...settings.howToRun,
											notes: e.target.value,
										},
									})
								}
								rows={2}
								className="mt-1"
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>AI Preferences</CardTitle>
						<CardDescription>Configure AI behavior</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<Label htmlFor="aiModel">Default Model</Label>
								<Input
									id="aiModel"
									value={settings.aiPreferences.defaultModel}
									onChange={(e) =>
										setSettings({
											...settings,
											aiPreferences: {
												...settings.aiPreferences,
												defaultModel: e.target.value,
											},
										})
									}
									className="mt-1"
								/>
							</div>
							<div>
								<Label htmlFor="aiProvider">Provider</Label>
								<Input
									id="aiProvider"
									value={settings.aiPreferences.provider}
									onChange={(e) =>
										setSettings({
											...settings,
											aiPreferences: {
												...settings.aiPreferences,
												provider: e.target.value,
											},
										})
									}
									className="mt-1"
								/>
							</div>
						</div>
						<div>
							<Label htmlFor="guardrails">Guardrails (one per line)</Label>
							<Textarea
								id="guardrails"
								value={settings.aiPreferences.guardrails.join("\n")}
								onChange={(e) =>
									setSettings({
										...settings,
										aiPreferences: {
											...settings.aiPreferences,
											guardrails: e.target.value.split("\n").filter(Boolean),
										},
									})
								}
								rows={4}
								className="mt-1"
							/>
						</div>
					</CardContent>
				</Card>

				{canSave && (
					<div className="flex justify-end">
						<Button onClick={handleSave} disabled={saving}>
							<FloppyDiskIcon className="w-4 h-4 mr-2" />
							{saving ? "Saving…" : "Save Settings"}
						</Button>
					</div>
				)}
			</div>
		);
	};

	return (
		<AppLayout
			title="Project Settings"
			description="Configure project defaults and AI automation preferences"
			backLink={{ href: "/", label: "Back to Dashboard" }}
		>
			{renderContent()}
		</AppLayout>
	);
}
