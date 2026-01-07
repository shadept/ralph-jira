'use client';

import { useCallback, useEffect, useState } from 'react';
import { FloppyDiskIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/app-layout';
import { useProjectContext } from '@/components/projects/project-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AutomationSettings,
  ProjectSettings,
  AgentAutomationSettings,
} from '@/lib/schemas';

const DEFAULT_AGENT_SETTINGS: AgentAutomationSettings = {
  name: 'claude',
  model: 'opus-4.5',
  bin: undefined,
  permissionMode: 'acceptEdits',
  extraArgs: [],
};

const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  setup: [],
  maxIterations: 5,
  agent: DEFAULT_AGENT_SETTINGS,
};

function ensureAgentDefaults(agent?: AgentAutomationSettings | null): AgentAutomationSettings {
  if (!agent) {
    return { ...DEFAULT_AGENT_SETTINGS, extraArgs: [...DEFAULT_AGENT_SETTINGS.extraArgs] };
  }
  return {
    ...DEFAULT_AGENT_SETTINGS,
    ...agent,
    extraArgs: Array.isArray(agent.extraArgs) ? [...agent.extraArgs] : [],
  };
}

function ensureAutomationDefaults(automation?: AutomationSettings | null): AutomationSettings {
  const base = automation ?? DEFAULT_AUTOMATION_SETTINGS;
  return {
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...base,
    setup: Array.isArray(base.setup) ? [...base.setup] : [],
    maxIterations:
      typeof base.maxIterations === 'number' && base.maxIterations > 0
        ? base.maxIterations
        : DEFAULT_AUTOMATION_SETTINGS.maxIterations,
    agent: ensureAgentDefaults(base.agent),
  };
}

function withAutomationDefaults(settings: ProjectSettings): ProjectSettings {
  return {
    ...settings,
    automation: ensureAutomationDefaults(settings.automation),
  };
}

export default function SettingsPage() {
  const { currentProject, loading: projectLoading, apiFetch } = useProjectContext();
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!currentProject) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/settings');
      const data = await res.json();
      setSettings(withAutomationDefaults(data.settings));
    } catch (error) {
      toast.error('Failed to load settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentProject]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!settings || !currentProject) return;

    setSaving(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateAutomation = (updater: (automation: AutomationSettings) => AutomationSettings) => {
    setSettings(prev => {
      if (!prev) return prev;
      const normalized = ensureAutomationDefaults(prev.automation);
      const updated = updater(normalized);
      return { ...prev, automation: ensureAutomationDefaults(updated) };
    });
  };

  const updateAgent = (updater: (agent: AgentAutomationSettings) => AgentAutomationSettings) => {
    updateAutomation(current => ({
      ...current,
      agent: updater(ensureAgentDefaults(current.agent)),
    }));
  };

  const actions = settings && currentProject ? (
    <Button onClick={handleSave} disabled={saving}>
      <FloppyDiskIcon className="w-4 h-4 mr-2" />
      {saving ? 'Saving…' : 'Save Settings'}
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
                onChange={(e) => setSettings({ ...settings, projectName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="projectDescription">Description</Label>
              <Textarea
                id="projectDescription"
                value={settings.projectDescription}
                onChange={(e) => setSettings({ ...settings, projectDescription: e.target.value })}
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="techStack">Tech Stack (comma-separated)</Label>
              <Input
                id="techStack"
                value={settings.techStack.join(', ')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    techStack: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })
                }
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coding Style</CardTitle>
            <CardDescription>Guidelines for code generation</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={settings.codingStyle}
              onChange={(e) => setSettings({ ...settings, codingStyle: e.target.value })}
              rows={4}
            />
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
                value={settings.howToTest.commands.join('\n')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    howToTest: {
                      ...settings.howToTest,
                      commands: e.target.value.split('\n').filter(Boolean),
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
                value={settings.howToRun.commands.join('\n')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    howToRun: {
                      ...settings.howToRun,
                      commands: e.target.value.split('\n').filter(Boolean),
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
                value={settings.aiPreferences.guardrails.join('\n')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    aiPreferences: {
                      ...settings.aiPreferences,
                      guardrails: e.target.value.split('\n').filter(Boolean),
                    },
                  })
                }
                rows={4}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automation</CardTitle>
            <CardDescription>Runner setup commands and agent configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="setupCommands">Setup Commands (one per line)</Label>
              <Textarea
                id="setupCommands"
                value={automation.setup.join('\n')}
                onChange={(e) => {
                  const commands = e.target.value
                    .split('\n')
                    .map(line => line.trim())
                    .filter(Boolean);
                  updateAutomation(current => ({ ...current, setup: commands }));
                }}
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="maxIterations">Max Iterations</Label>
                <Input
                  id="maxIterations"
                  type="number"
                  min={1}
                  value={automation.maxIterations}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    updateAutomation(current => ({
                      ...current,
                      maxIterations:
                        Number.isNaN(parsed) || parsed <= 0
                          ? DEFAULT_AUTOMATION_SETTINGS.maxIterations
                          : parsed,
                    }));
                  }}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="agentName">Runner Agent</Label>
              <Select
                value={agent.name}
                onValueChange={(value) =>
                  updateAgent(current => ({ ...current, name: value as AgentAutomationSettings['name'] }))
                }
              >
                <SelectTrigger id="agentName" className="mt-1">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="opencode">OpenCode</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="agentModel">Agent Model</Label>
                <Input
                  id="agentModel"
                  value={agent.model ?? ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    updateAgent(current => ({ ...current, model: value || undefined }));
                  }}
                  className="mt-1"
                  placeholder={agent.name === 'claude' ? 'opus-4.5 (default)' : 'Enter model ID'}
                />
              </div>
              <div>
                <Label htmlFor="agentBin">CLI Binary Override</Label>
                <Input
                  id="agentBin"
                  value={agent.bin ?? ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    updateAgent(current => ({ ...current, bin: value || undefined }));
                  }}
                  className="mt-1"
                  placeholder={agent.name}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="permissionMode">Permission Mode (Claude only)</Label>
              <Input
                id="permissionMode"
                value={agent.permissionMode ?? ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  updateAgent(current => ({ ...current, permissionMode: value || undefined }));
                }}
                className="mt-1"
                placeholder="acceptEdits"
              />
            </div>
            <div>
              <Label htmlFor="agentExtraArgs">Extra CLI Args (one per line)</Label>
              <Textarea
                id="agentExtraArgs"
                value={(agent.extraArgs ?? []).join('\n')}
                onChange={(e) => {
                  const args = e.target.value
                    .split('\n')
                    .map(line => line.trim())
                    .filter(Boolean);
                  updateAgent(current => ({ ...current, extraArgs: args }));
                }}
                rows={3}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <AppLayout
      title="Project Settings"
      description="Configure project defaults and AI automation preferences"
      actions={actions}
      backLink={{ href: '/', label: 'Back to Dashboard' }}
    >
      {renderContent()}
    </AppLayout>
  );
}

