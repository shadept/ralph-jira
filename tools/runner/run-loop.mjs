#!/usr/bin/env node
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const LOOP_PROMPT = `@plans/prd.json @progress.txt
1. Find the highest-priority feature to work on and work only on that feature.
This should be the one YOU decide has the highest priority - not necessarily the first in the list.
2. Check that the types check via npm typecheck and that the tests pass via npm test.
3. Updarte the PRD with the work that was done.
4. Append your process to the progress.txt file.
Use this to leave a note for the next person working in the codebase.
5. make a git commit of the feature.
ONLY WORK ON A SINGLE FEATURE.
If, while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>`;

const PENDING_STATUSES = new Set(['todo', 'in_progress']);
const MAX_LOG_SNIPPET = 1200;
const DEFAULT_SETUP = Object.freeze([]);
const DEFAULT_AGENT_NAME = 'claude';
const DEFAULT_CLAUDE_MODEL = 'opus-4.5';

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => `${item}`.trim()).filter(Boolean);
}

class CancellationSignal extends Error {}

async function readJson(filePath) {
  const buffer = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(buffer);
}

async function writeJson(filePath, payload) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function limitOutput(output, maxLength = MAX_LOG_SNIPPET) {
  if (!output) return '';
  if (output.length <= maxLength) return output.trim();
  return `${output.slice(0, maxLength)}\n...(output truncated)...`;
}

function parseArgs(argv) {
  const args = { runId: null, projectPath: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--runId' && argv[i + 1]) {
      args.runId = argv[i + 1];
      i += 1;
    } else if (current === '--projectPath' && argv[i + 1]) {
      args.projectPath = path.resolve(argv[i + 1]);
      i += 1;
    }
  }

  if (!args.runId) {
    throw new Error('Missing --runId argument');
  }

  return args;
}

function parseAgentExtraArgs() {
  const raw = process.env.RUN_LOOP_AGENT_EXTRA_ARGS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(value => `${value}`);
    }
  } catch {
    console.warn('RUN_LOOP_AGENT_EXTRA_ARGS must be a JSON array, e.g. ["--foo","bar"]');
  }
  return [];
}

class RunLoop {
  constructor({ runId, projectPath }) {
    this.runId = runId;
    this.projectPath = projectPath;
    this.runFile = path.join(projectPath, 'plans', 'runs', `${runId}.json`);
    this.rootProgressFile = path.join(projectPath, 'progress.txt');
    this.settingsPath = path.join(projectPath, 'plans', 'settings.json');
    this.sandboxSettingsPath = null;
    this.run = null;
    this.sandboxDir = null;
    this.sandboxBoardPath = null;
    this.rootBoardPath = null;
    this.sandboxLogPath = null;
    this.persistedLogPath = null;
    this.cancelFlagPath = null;
    this.settings = null;
    this.setupCommands = DEFAULT_SETUP;
    this.worktreeAdded = false;
    this.worktreeBranch = null;
    this.passed = 0;
    this.failed = 0;
    this.reason = 'completed';
    this.status = 'completed';
    const envAgentName = process.env.RUN_LOOP_AGENT || DEFAULT_AGENT_NAME;
    this.agentName = envAgentName.toLowerCase();
    this.agentBin = process.env.RUN_LOOP_AGENT_BIN || this.agentName;
    this.agentModel = process.env.RUN_LOOP_AGENT_MODEL || null;
    this.agentExtraArgsFromEnv = Object.prototype.hasOwnProperty.call(
      process.env,
      'RUN_LOOP_AGENT_EXTRA_ARGS',
    );
    this.agentExtraArgs = parseAgentExtraArgs();
    this.claudePermissionMode = process.env.RUN_LOOP_CLAUDE_PERMISSION_MODE || 'acceptEdits';
  }

  async init() {
    this.run = await readJson(this.runFile);
    this.sandboxDir = path.join(this.projectPath, this.run.sandboxPath);
    this.sandboxBoardPath = path.join(this.sandboxDir, 'plans', 'prd.json');
    this.rootBoardPath = path.join(this.projectPath, this.run.boardSourcePath);
    this.sandboxLogPath = path.join(
      this.projectPath,
      this.run.sandboxLogPath || path.join(this.run.sandboxPath, 'progress.txt'),
    );
    this.persistedLogPath = path.join(
      this.projectPath,
      this.run.logPath || path.join('plans', 'runs', `${this.runId}.progress.txt`),
    );
    this.cancelFlagPath = path.join(this.projectPath, this.run.cancelFlagPath);
    const configuredBranch =
      typeof this.run.sandboxBranch === 'string' && this.run.sandboxBranch.trim().length
        ? this.run.sandboxBranch.trim()
        : `run-${this.runId}`;
    this.worktreeBranch = configuredBranch;
    if (this.run.sandboxBranch !== configuredBranch) {
      await this.updateRun({ sandboxBranch: configuredBranch });
    }
    await this.loadSettingsFrom(this.settingsPath);
  }

  async updateRun(patch) {
    this.run = { ...this.run, ...patch };
    try {
      await writeJson(this.runFile, this.run);
    } catch (error) {
      console.error('Unable to persist run update', error);
    }
  }

  async appendSandboxLog(lines) {
    const payload = Array.isArray(lines) ? lines.join('\n') : lines;
    const timestamp = new Date().toISOString();
    await fs.appendFile(this.sandboxLogPath, `\n[${timestamp}]\n${payload}\n`, 'utf-8');
    await this.updateRun({ lastProgressAt: timestamp });
  }

  async appendRootProgress(summary) {
    const timestamp = new Date().toISOString();
    const block = `\n[${timestamp}]\n${summary.trim()}\n`;
    await fs.appendFile(this.rootProgressFile, block, 'utf-8');
  }

  async ensureSandboxParent() {
    await fs.mkdir(path.dirname(this.sandboxDir), { recursive: true });
  }

  getEffectiveBranchName() {
    if (this.worktreeBranch?.trim().length) {
      return this.worktreeBranch.trim();
    }
    if (this.run?.sandboxBranch?.trim().length) {
      return this.run.sandboxBranch.trim();
    }
    return `run-${this.runId}`;
  }

  async branchExists(branchName) {
    const result = await this.runCommand('git', ['rev-parse', '--verify', branchName], this.projectPath);
    return result.code === 0;
  }

  async checkoutWorkspace() {
    await this.ensureSandboxParent();
    await this.removeWorktree({ silent: true });
    const branchName = this.getEffectiveBranchName();
    this.worktreeBranch = branchName;
    const branchExists = await this.branchExists(branchName);
    const args = branchExists
      ? ['worktree', 'add', '--force', this.sandboxDir, branchName]
      : ['worktree', 'add', '--force', '-b', branchName, this.sandboxDir];
    const result = await this.runCommand('git', args, this.projectPath);
    if (result.code !== 0) {
      const snippet = limitOutput(result.stderr || result.stdout || '');
      throw new Error(`git worktree add failed (code ${result.code}). ${snippet}`.trim());
    }
    if (!this.run?.sandboxBranch || this.run.sandboxBranch !== branchName) {
      await this.updateRun({ sandboxBranch: branchName });
    }
    this.worktreeAdded = true;
  }

  async removeWorktree(options = {}) {
    const { silent = false } = options;
    try {
      const result = await this.runCommand(
        'git',
        ['worktree', 'remove', '--force', this.sandboxDir],
        this.projectPath,
      );
      if (result.code !== 0 && !silent) {
        const snippet = limitOutput(result.stderr || result.stdout || '');
        console.warn(`git worktree remove failed (code ${result.code}). ${snippet}`.trim());
      }
    } catch (error) {
      if (!silent) {
        console.warn('Unable to execute git worktree remove', error);
      }
    }

    this.worktreeAdded = false;
    try {
      await fs.rm(this.sandboxDir, { recursive: true, force: true });
    } catch (error) {
      if (!silent && error.code !== 'ENOENT') {
        console.warn('Unable to delete sandbox directory', error);
      }
    }

    // Keep the branch around for review/merge; just clear local reference
    this.worktreeBranch = null;
  }

  async cleanupSandbox() {
    if (!this.worktreeAdded && !(await fileExists(this.sandboxDir))) {
      return;
    }
    const safeToDelete = await this.ensureWorktreeSafeToDelete();
    if (!safeToDelete) {
      const branchName = this.getEffectiveBranchName();
      await this.appendSandboxLog(
        `Skipping sandbox cleanup for branch ${branchName} due to uncommitted or unpushed work. Push commits to origin before rerunning cleanup.`,
      );
      return;
    }
    await this.removeWorktree({ silent: false });
  }

  async ensureWorktreeSafeToDelete() {
    if (!this.worktreeAdded) {
      return true;
    }

    const branchName = this.getEffectiveBranchName();
    if (!branchName) {
      return true;
    }

    const statusResult = await this.runCommand('git', ['status', '--porcelain'], this.sandboxDir);
    if (statusResult.code !== 0) {
      console.warn('Unable to inspect sandbox status before cleanup');
      return false;
    }
    if (statusResult.stdout.trim().length > 0) {
      console.warn('Sandbox has uncommitted changes; leaving worktree in place.');
      return false;
    }

    const fetchResult = await this.runCommand('git', ['fetch', 'origin', branchName], this.projectPath);
    if (fetchResult.code !== 0) {
      console.warn(`Unable to fetch origin/${branchName}. Push your commits before cleanup.`);
      return false;
    }

    const aheadResult = await this.runCommand(
      'git',
      ['rev-list', '--count', `origin/${branchName}..${branchName}`],
      this.projectPath,
    );
    if (aheadResult.code !== 0) {
      console.warn('Unable to determine push status for sandbox branch.');
      return false;
    }
    const ahead = parseInt(aheadResult.stdout.trim(), 10);
    if (Number.isNaN(ahead)) {
      console.warn('Unexpected response while checking push status.');
      return false;
    }
    if (ahead > 0) {
      console.warn(`Branch ${branchName} has ${ahead} unpushed commits.`);
      return false;
    }

    return true;
  }

  async prepareSandboxPlan() {
    const board = await readJson(this.rootBoardPath);
    const filteredTasks = board.tasks.filter(task => PENDING_STATUSES.has(task.status));
    const sandboxBoard = { ...board, tasks: filteredTasks };
    await fs.mkdir(path.dirname(this.sandboxBoardPath), { recursive: true });
    await writeJson(this.sandboxBoardPath, sandboxBoard);
    this.sandboxSettingsPath = path.join(this.sandboxDir, 'plans', 'settings.json');
    await fs.copyFile(this.settingsPath, this.sandboxSettingsPath);
    await fs.writeFile(this.sandboxLogPath, `# Run ${this.runId} progress\n`, 'utf-8');
    await this.loadSettingsFrom(this.sandboxSettingsPath);
  }

  async loadSettingsFrom(filePath) {
    this.settings = await readJson(filePath);
    this.applyAutomationSettings();
  }

  applyAutomationSettings() {
    const automation = this.settings?.automation || {};
    const setupCommands = normalizeStringArray(automation.setup);
    this.setupCommands = setupCommands.length ? setupCommands : DEFAULT_SETUP;

    const agentSettings = automation.agent || {};
    const envAgentName = process.env.RUN_LOOP_AGENT;
    const envAgentBin = process.env.RUN_LOOP_AGENT_BIN;
    const envAgentModel = process.env.RUN_LOOP_AGENT_MODEL;
    const envPermission = process.env.RUN_LOOP_CLAUDE_PERMISSION_MODE;

    const normalizedAgentName =
      typeof agentSettings.name === 'string' ? agentSettings.name.trim().toLowerCase() : undefined;
    const resolvedAgentName = (envAgentName || normalizedAgentName || DEFAULT_AGENT_NAME).toLowerCase();

    this.agentName = resolvedAgentName;
    const normalizedBin = typeof agentSettings.bin === 'string' ? agentSettings.bin.trim() : undefined;
    this.agentBin = envAgentBin || normalizedBin || this.agentName;

    const defaultModel = resolvedAgentName === 'claude' ? DEFAULT_CLAUDE_MODEL : null;
    const normalizedModel =
      typeof agentSettings.model === 'string' && agentSettings.model.trim().length
        ? agentSettings.model.trim()
        : undefined;
    this.agentModel = envAgentModel || normalizedModel || defaultModel;

    const settingsExtraArgs = normalizeStringArray(agentSettings.extraArgs);
    if (!this.agentExtraArgsFromEnv) {
      this.agentExtraArgs = [...settingsExtraArgs];
    }

    const normalizedPermission =
      typeof agentSettings.permissionMode === 'string' && agentSettings.permissionMode.trim().length
        ? agentSettings.permissionMode.trim()
        : undefined;

    this.claudePermissionMode =
      envPermission || normalizedPermission || this.claudePermissionMode || 'acceptEdits';
  }

  getSetupCommands() {
    return Array.isArray(this.setupCommands) ? [...this.setupCommands] : [];
  }

  async runCommand(command, argsOrString, cwd, options = {}) {
    const useShell = typeof argsOrString === 'string' || options.shell === true;
    const cmdString = Array.isArray(argsOrString)
      ? `${command} ${argsOrString.join(' ')}`
      : argsOrString;
    const finalCommand = useShell
      ? typeof argsOrString === 'string'
        ? argsOrString
        : `${command} ${argsOrString.join(' ')}`
      : command;
    const args = useShell ? [] : Array.isArray(argsOrString) ? argsOrString : [];

    await this.updateRun({ lastCommand: cmdString, lastCommandExitCode: undefined });

    return new Promise((resolve, reject) => {
      const child = spawn(finalCommand, args, {
        cwd,
        env: options.env ? { ...process.env, ...options.env } : { ...process.env },
        shell: useShell,
      });

      const stdoutChunks = [];
      const stderrChunks = [];

      child.stdout?.on('data', chunk => stdoutChunks.push(chunk));
      child.stderr?.on('data', chunk => stderrChunks.push(chunk));
      child.on('error', reject);
      child.on('close', code => {
        const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        this.updateRun({ lastCommandExitCode: code ?? null });
        resolve({ code, stdout, stderr });
      });
    });
  }

  async verifyCancellation() {
    if (!this.cancelFlagPath) return false;
    if (existsSync(this.cancelFlagPath)) {
      await this.updateRun({ lastMessage: 'Cancellation signal received', reason: 'canceled' });
      return true;
    }
    return false;
  }

  getAgentInvocation(prompt) {
    if (!this.agentModel) {
      throw new Error(
        `Agent "${this.agentName}" requires a model. Configure automation.agent.model or RUN_LOOP_AGENT_MODEL.`,
      );
    }
    const baseArgs = [...this.agentExtraArgs, '--model', this.agentModel];
    if (this.agentName === 'opencode') {
      return {
        command: this.agentBin,
        args: [...baseArgs, '-p', prompt],
        prompt,
      };
    }

    if (this.agentName === 'claude') {
      return {
        command: this.agentBin,
        args: [...baseArgs, '--permission-mode', this.claudePermissionMode, '-p', prompt],
        prompt,
      };
    }

    throw new Error(
      `Unsupported RUN_LOOP_AGENT "${this.agentName}". Set RUN_LOOP_AGENT to "claude" or "opencode".`,
    );
  }

  describeInvocation(invocation) {
    return `${invocation.command} ${invocation.args
      .map(arg => (arg === invocation.prompt ? '[prompt omitted]' : arg))
      .join(' ')}`.trim();
  }

  async runAgentIteration(iteration) {
    const prompt = LOOP_PROMPT;
    const invocation = this.getAgentInvocation(prompt);
    await this.appendSandboxLog([
      `Running ${this.agentName} (iteration ${iteration})`,
      `Command: ${this.describeInvocation(invocation)}`,
    ]);

    const result = await this.runCommand(invocation.command, invocation.args, this.sandboxDir);
    const combinedOutput = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim();
    const snippet = limitOutput(combinedOutput);
    await this.appendSandboxLog(snippet || '(no output)');
    return { output: combinedOutput, exitCode: result.code ?? 0 };
  }

  async runSetup() {
    const commands = this.getSetupCommands();
    if (!commands.length) {
      await this.appendSandboxLog('No setup commands configured. Skipping setup step.');
      return;
    }
    for (const command of commands) {
      await this.appendSandboxLog(`Running setup command: ${command}`);
      const result = await this.runCommand(command, command, this.sandboxDir, { shell: true });
      await this.appendSandboxLog(limitOutput(result.stdout || result.stderr));
      if (await this.verifyCancellation()) {
        throw new CancellationSignal('Cancellation during setup');
      }
      if (result.code !== 0) {
        throw new Error(`Setup command failed: ${command}`);
      }
    }
  }

  async syncBackToRoot() {
    const sandboxBoard = await readJson(this.sandboxBoardPath).catch(() => null);
    if (!sandboxBoard) return;
    const rootBoard = await readJson(this.rootBoardPath).catch(() => null);
    if (!rootBoard) return;

    const sandboxMap = new Map();
    for (const task of sandboxBoard.tasks) {
      sandboxMap.set(task.id, task);
    }

    const selected = new Set(
      this.run.selectedTaskIds?.length ? this.run.selectedTaskIds : Array.from(sandboxMap.keys()),
    );
    const now = new Date().toISOString();

    rootBoard.tasks = rootBoard.tasks.map(task => {
      if (!selected.has(task.id)) return task;
      const sandboxTask = sandboxMap.get(task.id);
      if (!sandboxTask) {
        return { ...task, status: 'in_progress', updatedAt: now };
      }
      const passes = sandboxTask.passes === true;
      return {
        ...task,
        passes,
        failureNotes: passes ? undefined : sandboxTask.failureNotes,
        filesTouched: sandboxTask.filesTouched,
        lastRun: sandboxTask.lastRun || now,
        status: passes ? 'review' : 'in_progress',
        updatedAt: sandboxTask.updatedAt || now,
      };
    });

    rootBoard.updatedAt = now;
    await writeJson(this.rootBoardPath, rootBoard);
  }

  async copyLogs() {
    await fs.mkdir(path.dirname(this.persistedLogPath), { recursive: true });
    await fs.copyFile(this.sandboxLogPath, this.persistedLogPath);
  }

  async captureSandboxStats() {
    try {
      const board = await readJson(this.sandboxBoardPath);
      this.passed = board.tasks.filter(task => task.passes === true).length;
      this.failed = board.tasks.filter(task => task.passes !== true).length;
    } catch (error) {
      console.warn('Unable to compute sandbox stats', error.message || error);
    }
  }

  async runLoop() {
    this.status = 'running';
    this.reason = 'completed';
    this.passed = 0;
    this.failed = 0;
    await this.updateRun({
      status: 'running',
      startedAt: new Date().toISOString(),
      lastMessage: 'Preparing sandbox…',
    });

    await this.checkoutWorkspace();
    await this.prepareSandboxPlan();
    const sandboxBoard = await readJson(this.sandboxBoardPath);
    if (!sandboxBoard.tasks.length) {
      this.status = 'completed';
      this.reason = 'completed';
      await this.updateRun({ status: 'completed', lastMessage: 'No todo/in-progress tasks found', currentIteration: 0 });
      await this.appendSandboxLog('No pending tasks found in sandbox PRD. Exiting.');
      return;
    }

    try {
      await this.runSetup();
    } catch (error) {
      if (error instanceof CancellationSignal) {
        this.status = 'canceled';
        this.reason = 'canceled';
        await this.updateRun({ lastMessage: 'Setup canceled' });
        return;
      }
      throw error;
    }

    for (let iteration = 1; iteration <= this.run.maxIterations; iteration += 1) {
      if (await this.verifyCancellation()) {
        this.reason = 'canceled';
        this.status = 'canceled';
        break;
      }

      await this.updateRun({
        currentIteration: iteration,
        lastTaskId: undefined,
        lastMessage: `Iteration ${iteration}: running ${this.agentName}`,
      });

      const { output, exitCode } = await this.runAgentIteration(iteration);

      if (exitCode !== 0) {
        this.status = 'failed';
        this.reason = 'error';
        await this.appendSandboxLog(`Agent exited with code ${exitCode}. Stopping run.`);
        break;
      }

      if (output?.includes('<promise>COMPLETE</promise>')) {
        this.status = 'completed';
        this.reason = 'completed';
        await this.appendSandboxLog('Received <promise>COMPLETE</promise> from agent.');
        break;
      }
    }

    if (this.status === 'running') {
      this.status = 'stopped';
      this.reason = 'max_iterations';
      await this.appendSandboxLog('Reached max iterations without completion.');
    }
  }

  async finalize(error) {
    try {
      await this.syncBackToRoot();
    } catch (syncError) {
      console.error('Failed to sync sandbox back to root', syncError);
    }

    try {
      await this.copyLogs();
    } catch (copyError) {
      console.error('Unable to archive sandbox log', copyError);
    }

    await this.captureSandboxStats();

    const finishedAt = new Date().toISOString();
    const existingErrors = Array.isArray(this.run.errors) ? this.run.errors : [];
    const finalRunState = {
      status: this.status,
      reason: this.reason,
      finishedAt,
      lastMessage: this.status === 'completed'
        ? 'Run completed'
        : `Run stopped (${this.reason})`,
      errors: error ? [...existingErrors, error.message || String(error)] : existingErrors,
    };
    await this.updateRun(finalRunState);

    const summary = [
      `Run ${this.runId} finished with status ${this.status} (${this.reason}).`,
      `Agent: ${this.agentName}.`,
      `Passed: ${this.passed}, Failed: ${this.failed}.`,
      `Log: ${path.relative(this.projectPath, this.persistedLogPath)}`,
      `Details: plans/runs/${this.runId}.json`,
    ].join('\n');
    await this.appendRootProgress(summary);

    try {
      await this.cleanupSandbox();
    } catch (error) {
      console.warn('Unable to clean up sandbox workspace', error);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runner = new RunLoop(args);
  try {
    await runner.init();
    await runner.runLoop();
    await runner.finalize();
  } catch (error) {
    console.error('Runner failed', error);
    runner.status = 'failed';
    runner.reason = runner.reason === 'completed' ? 'error' : runner.reason;
    await runner.finalize(error);
    process.exit(1);
  }
}

main();
