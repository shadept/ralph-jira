#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createAgent } from './agents.mjs';
import { initBackendClient, getBackendClient } from './backend-client.mjs';
import { WorkspaceManager } from './workspace-manager.mjs';

// Global error handlers to prevent silent exits
process.on('uncaughtException', (error) => {
  console.error('[run-loop] UNCAUGHT EXCEPTION:', error.message);
  console.error('[run-loop] Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[run-loop] UNHANDLED REJECTION at:', promise);
  console.error('[run-loop] Reason:', reason);
  if (reason instanceof Error) {
    console.error('[run-loop] Stack:', reason.stack);
  }
  process.exit(1);
});

process.on('exit', (code) => {
  console.log('[run-loop] Process exiting with code:', code);
});

const MAX_LOG_SNIPPET = 1200;
const DEFAULT_SETUP = Object.freeze([]);
const DEFAULT_AGENT_NAME = 'claude';
const DEFAULT_CLAUDE_MODEL = 'opus';

/**
 * Normalizes an input into a trimmed array of strings.
 * @param {any} value
 * @returns {string[]}
 */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => `${item}`.trim()).filter(Boolean);
}

/**
 * Signal used to stop the loop when cancellation is detected.
 */
export class CancellationSignal extends Error { }

/**
 * Reads a JSON file and parses its content.
 * @param {string} filePath
 * @returns {Promise<any>}
 */
async function readJson(filePath) {
  const buffer = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(buffer);
}

/**
 * Truncates a string to a maximum length for logging.
 * @param {string} output
 * @param {number} [maxLength]
 * @returns {string}
 */
function limitOutput(output, maxLength = MAX_LOG_SNIPPET) {
  if (!output) return '';
  if (output.length <= maxLength) return output.trim();
  return `${output.slice(0, maxLength)}\n...(output truncated)...`;
}

/**
 * Parses command line arguments.
 * @param {string[]} argv
 * @returns {{runId: string, projectPath: string}}
 */
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

/**
 * Parses extra agent arguments from the environment.
 * @returns {string[]}
 */
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

/**
 * Manages the execution loop for an autonomous coding agent.
 * Handles iterations and delegates workspace management to WorkspaceManager.
 */
class RunLoop {
  /**
   * @param {{runId: string, projectPath: string}} options
   */
  constructor({ runId, projectPath }) {
    this.runId = runId;
    this.projectPath = projectPath;
    this.backend = getBackendClient();
    this.rootProgressFile = path.join(projectPath, 'progress.txt');
    this.sandboxSettingsPath = null;
    this.run = null;
    this.sandboxDir = null;
    this.sandboxBoardPath = null;
    this.rootBoardPath = null;
    this.sandboxLogPath = null;
    this.persistedLogPath = null;
    this.settings = null;
    this.setupCommands = DEFAULT_SETUP;
    this.reason = 'completed';
    this.status = 'completed';
    this.agent = null;
    this.workspace = null; // WorkspaceManager instance
    const envAgentName = process.env.RUN_LOOP_AGENT || DEFAULT_AGENT_NAME;
    this.agentName = envAgentName.toLowerCase();
    this.agentBin = process.env.RUN_LOOP_AGENT_BIN || this.agentName;
    this.agentModel = process.env.RUN_LOOP_AGENT_MODEL || null;
    this.agentExtraArgsFromEnv = Object.prototype.hasOwnProperty.call(
      process.env,
      'RUN_LOOP_AGENT_EXTRA_ARGS',
    );
    this.agentExtraArgs = parseAgentExtraArgs();
    this.claudePermissionMode = process.env.RUN_LOOP_CLAUDE_PERMISSION_MODE || 'bypassPermissions';
    this.updateQueue = Promise.resolve();
    this.logBuffer = '';
    this.sandboxReady = false;
    this.earlyLogBuffer = [];
  }

  /**
   * Initializes the run state by reading configuration from the API.
   * @returns {Promise<void>}
   */
  async init() {
    console.log('[run-loop:init] Starting init for runId:', this.runId);

    console.log('[run-loop:init] Reading run from backend...');
    this.run = await this.backend.readRun(this.runId);
    console.log('[run-loop:init] Run record:', JSON.stringify(this.run, null, 2));

    // sandboxPath can be relative (new style: .worktrees/run-xxx) or absolute (legacy)
    // If absolute (legacy), compute worktree path from runId
    // If relative, join with projectPath
    this.sandboxDir = path.isAbsolute(this.run.sandboxPath)
      ? path.join(this.projectPath, '.worktrees', this.runId)
      : path.join(this.projectPath, this.run.sandboxPath);
    this.sandboxBoardPath = path.join(this.sandboxDir, 'plans', 'prd.json');
    this.sandboxSettingsPath = path.join(this.sandboxDir, 'plans', 'settings.json');
    this.sandboxLogPath = path.join(this.sandboxDir, 'progress.txt');
    this.persistedLogPath = path.join(
      this.projectPath,
      'plans',
      'runs',
      `${this.runId}.progress.txt`,
    );
    console.log('[run-loop:init] Paths configured:', {
      sandboxDir: this.sandboxDir,
      sandboxBoardPath: this.sandboxBoardPath,
      sandboxLogPath: this.sandboxLogPath,
    });

    const configuredBranch =
      typeof this.run.sandboxBranch === 'string' && this.run.sandboxBranch.trim().length
        ? this.run.sandboxBranch.trim()
        : `run-${this.runId}`;
    console.log('[run-loop:init] Branch:', configuredBranch);

    if (this.run.sandboxBranch !== configuredBranch) {
      console.log('[run-loop:init] Updating run with branch name...');
      await this.updateRun({ sandboxBranch: configuredBranch });
    }

    console.log('[run-loop:init] Reading settings from backend...');
    this.settings = await this.backend.readSettings();
    console.log('[run-loop:init] Settings loaded');

    this.applyAutomationSettings();
    console.log('[run-loop:init] Automation settings applied, agent:', this.agentName);

    // Create WorkspaceManager instance
    console.log('[run-loop:init] Creating WorkspaceManager...');
    this.workspace = new WorkspaceManager({
      runId: this.runId,
      projectPath: this.projectPath,
      sandboxDir: this.sandboxDir,
      sandboxBoardPath: this.sandboxBoardPath,
      sandboxLogPath: this.sandboxLogPath,
      sandboxSettingsPath: this.sandboxSettingsPath,
      runCommand: this.runCommand.bind(this),
      appendLog: this.appendSandboxLog.bind(this),
      markSandboxReady: this.markSandboxReady.bind(this),
      backend: this.backend,
      settings: this.settings,
      agentName: this.agentName,
    });
    this.workspace.setBranchName(configuredBranch);
    console.log('[run-loop:init] Init complete');
  }

  /**
   * Persists a patch to the run state via API.
   * @param {Partial<RunRecord>} patch
   * @returns {Promise<void>}
   */
  async updateRun(patch) {
    this.run = { ...this.run, ...patch };

    // Chain update to queue to avoid concurrent writes
    this.updateQueue = this.updateQueue.then(async () => {
      try {
        await this.backend.writeRun(this.run);
      } catch (error) {
        console.error('Unable to persist run update', error);
      }
    });

    return this.updateQueue;
  }

  /**
   * Single write point for sandbox log - enables stdout redirection later.
   * Buffers logs until sandbox is ready.
   * @param {string} text
   * @returns {Promise<void>}
   */
  async writeLog(text) {
    if (!this.sandboxLogPath) return;
    if (!this.sandboxReady) {
      this.earlyLogBuffer.push(text);
      return;
    }
    await fs.appendFile(this.sandboxLogPath, text, 'utf-8');
  }

  /**
   * Marks the sandbox as ready and flushes any buffered early logs.
   * @returns {Promise<void>}
   */
  async markSandboxReady() {
    this.sandboxReady = true;
    if (this.earlyLogBuffer.length > 0) {
      const buffered = this.earlyLogBuffer.join('');
      this.earlyLogBuffer = [];
      await fs.appendFile(this.sandboxLogPath, buffered, 'utf-8');
    }
  }

  /**
   * Appends text to the sandbox log buffer. Flushes complete lines.
   * Also sends logs to the backend API.
   * @param {string} text
   * @returns {Promise<void>}
   */
  async appendSandboxLog(text) {
    this.logBuffer += text;
    const lastNewline = this.logBuffer.lastIndexOf('\n');
    if (lastNewline !== -1) {
      const toFlush = this.logBuffer.slice(0, lastNewline + 1);
      this.logBuffer = this.logBuffer.slice(lastNewline + 1);
      await this.writeLog(toFlush);

      // Send log to API
      try {
        await this.backend.appendLog(this.runId, toFlush);
      } catch (error) {
        console.warn('Unable to send log to API', error.message);
      }

      await this.updateRun({ lastProgressAt: new Date().toISOString() });
    }
  }

  /**
   * Force flushes any remaining content in the log buffer.
   * @returns {Promise<void>}
   */
  async flushSandboxLog() {
    if (!this.logBuffer) return;
    await this.writeLog(this.logBuffer);

    // Send remaining log to API
    try {
      await this.backend.appendLog(this.runId, this.logBuffer);
    } catch (error) {
      console.warn('Unable to send final log to API', error.message);
    }

    this.logBuffer = '';
    await this.updateRun({ lastProgressAt: new Date().toISOString() });
  }

  /**
   * Appends a summary to the root progress file.
   * @param {string} summary
   * @returns {Promise<void>}
   */
  async appendRootProgress(summary) {
    const block = summary;
    await fs.appendFile(this.rootProgressFile, block, 'utf-8');
  }

  /**
   * Loads global or sandbox settings from a file.
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  async loadSettingsFrom(filePath) {
    this.settings = await readJson(filePath);
    this.applyAutomationSettings();
    if (this.workspace) {
      this.workspace.setSettings(this.settings);
    }
  }

  /**
   * Applies settings from the configuration to the internal runner state.
   */
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
    this.agentBin = envAgentBin || this.agentName;

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
      envPermission || normalizedPermission || this.claudePermissionMode || 'bypassPermissions';

    this.agent = createAgent(this.agentName, {
      bin: this.agentBin,
      model: this.agentModel,
      extraArgs: this.agentExtraArgs,
      permissionMode: this.claudePermissionMode,
      codingStyle: (this.settings?.automation?.codingStyle || '').trim(),
    });
  }

  /**
   * Spawns a shell command and captures its output.
   * @param {string} command
   * @param {string[]} args
   * @param {string} cwd
   * @param {object} [options]
   * @param {boolean} [options.shell] - Whether to use a shell for execution.
   * @param {object} [options.env] - Additional environment variables.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>}
   */
  async runCommand(command, args, cwd, options = {}) {
    if (!Array.isArray(args)) {
      throw new Error(`runCommand expects an array for the second argument, got ${typeof args}`);
    }

    const escapeForDisplay = (arg) => {
      if (typeof arg !== 'string') return `${arg}`;
      if (arg.length === 0) return '""';
      if (/[ \t\n\r"']/.test(arg)) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    };

    console.log("runCommand", command, args)
    const startedAt = new Date().toISOString();
    const cmdString = [command, ...args].map(escapeForDisplay).join(' ');

    // Log timestamp and command to sandbox log
    await this.appendSandboxLog(`\n[${startedAt}] ${cmdString}\n`);

    // Create command record in database
    let commandRecord = null;
    try {
      commandRecord = await this.backend.createCommand(this.runId, {
        command,
        args,
        cwd,
        startedAt,
      });
    } catch (err) {
      console.warn('Unable to create command record', err.message);
    }

    await this.updateRun({
      lastCommand: cmdString,
      lastCommandExitCode: undefined,
    });

    return new Promise((resolve, reject) => {
      console.log("Spawning", command, args)

      // Clean environment variables to prevent VSCode debugger interference
      const cleanEnv = { ...(options.env || process.env) };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.VSCODE_INSPECTOR_OPTIONS;

      const timeoutMs = options.timeout || 10000;
      let timer = null;

      const child = spawn(command, args, {
        cwd,
        env: cleanEnv,
        shell: options.shell || false,
        windowsHide: true,
      });

      const stdoutChunks = [];
      const stderrChunks = [];

      const updateCommandFinished = (exitCode) => {
        const finishedAt = new Date().toISOString();
        if (commandRecord?.id) {
          this.backend.updateCommand(this.runId, {
            id: commandRecord.id,
            exitCode,
            finishedAt,
          }).catch(err => console.warn('Unable to update command record', err.message));
        }
        this.updateRun({ lastCommandExitCode: exitCode }).catch(() => { });
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          child.kill('SIGKILL');
          const err = new Error(`Command timed out after ${timeoutMs}ms: ${cmdString}`);
          err.code = 'ETIMEDOUT';
          err.stdout = Buffer.concat(stdoutChunks).toString('utf-8');
          err.stderr = Buffer.concat(stderrChunks).toString('utf-8');

          updateCommandFinished(-2);
          reject(err);
        }, timeoutMs);
      }

      child.stdin?.end();

      child.stdout?.on('data', chunk => {
        stdoutChunks.push(chunk);
        if (typeof options.onStdout === 'function') {
          options.onStdout(chunk);
        } else {
          this.appendSandboxLog(chunk.toString('utf-8')).catch(() => { });
        }
      });
      child.stderr?.on('data', chunk => {
        stderrChunks.push(chunk);
        if (typeof options.onStderr === 'function') {
          options.onStderr(chunk);
        } else {
          this.appendSandboxLog(chunk.toString('utf-8')).catch(() => { });
        }
      });
      child.on('error', err => {
        if (timer) clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');

        updateCommandFinished(-1);
        reject(Object.assign(err, { stdout, stderr, code: -1 }));
      });
      child.on('close', code => {
        if (timer) clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');

        updateCommandFinished(code ?? null);
        resolve({ code, stdout, stderr });
      });
    });
  }

  /**
   * Checks if cancellation has been requested via the API.
   * @returns {Promise<boolean>}
   */
  async verifyCancellation() {
    const canceled = await this.backend.checkCancellation(this.runId);
    if (canceled) {
      this.status = 'canceled';
      this.reason = 'canceled';
      await this.updateRun({
        lastMessage: 'Cancellation signal received',
        status: 'canceled',
        reason: 'canceled'
      });
      return true;
    }
    return false;
  }

  /**
   * Checks for cancellation and throws if detected.
   * @throws {CancellationSignal}
   * @returns {Promise<void>}
   */
  async checkCancellationSignal() {
    if (await this.verifyCancellation()) {
      throw new CancellationSignal('Run canceled by user');
    }
  }

  /**
   * Invokes the agent for a single iteration.
   * @param {number} iteration
   * @returns {Promise<{output: string, exitCode: number}>}
   */
  async runAgentIteration(iteration) {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    /**
     * Adds or updates a command record in the run's command list.
     * @param {object} commandRecord - The command record to add or update
     * @returns {Promise<void>}
     */
    const addCommand = async (commandRecord) => {
      if (!Array.isArray(this.run.commands)) {
        this.run.commands = [];
      }
      if (!this.run.commands.includes(commandRecord)) {
        this.run.commands.push(commandRecord);
      }
      const cmdString = [commandRecord.command, ...(commandRecord.args || [])].join(' ');
      await this.updateRun({
        commands: this.run.commands,
        lastCommand: cmdString,
        lastCommandExitCode: commandRecord.exitCode,
      });
    };

    const { output, exitCode } = await this.agent.run({
      iteration,
      sandboxDir: this.sandboxDir,
      runCommand: this.runCommand.bind(this),
      addCommand,
      appendSandboxLog: this.appendSandboxLog.bind(this),
      flushSandboxLog: this.flushSandboxLog.bind(this),
      updateRun: this.updateRun.bind(this),
      checkCancellation: this.checkCancellationSignal.bind(this),
    });

    if (!output) {
      await this.appendSandboxLog('(no output)');
    }
    return { output, exitCode };
  }


  /**
   * Synchronizes changes from the sandbox PRD back to the root PRD via API.
   * @returns {Promise<void>}
   */
  async syncBackToRoot() {
    // Sandbox board is local filesystem
    const sandboxBoard = await readJson(this.sandboxBoardPath).catch(() => null);
    if (!sandboxBoard) return;

    // Root board via backend API (using sprint terminology)
    const sprintId = this.run.sprintId || this.run.boardId || 'prd';
    const rootBoard = await this.backend.readSprint(sprintId).catch(() => null);
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
    await this.backend.writeSprint(rootBoard);
  }


  /**
   * The main iteration loop.
   * @returns {Promise<void>}
   */
  async runLoop() {
    console.log('[run-loop:runLoop] Starting runLoop');
    this.status = 'running';
    this.reason = 'completed';
    await this.updateRun({
      status: 'running',
      startedAt: new Date().toISOString(),
      lastMessage: 'Preparing sandbox…',
    });
    console.log('[run-loop:runLoop] Status set to running');

    // Checkout workspace and prepare sandbox plan via WorkspaceManager
    console.log('[run-loop:runLoop] Calling workspace.checkoutWorkspace()...');
    const branchName = await this.workspace.checkoutWorkspace();
    console.log('[run-loop:runLoop] Workspace checked out, branch:', branchName);

    if (branchName && this.run.sandboxBranch !== branchName) {
      await this.updateRun({ sandboxBranch: branchName });
    }
    const sprintId = this.run.sprintId || this.run.boardId || 'prd';
    console.log('[run-loop:runLoop] Calling workspace.prepareSandboxPlan() for sprint:', sprintId);
    await this.workspace.prepareSandboxPlan(sprintId);
    console.log('[run-loop:runLoop] Sandbox plan prepared');

    // Reload settings from sandbox after prepareSandboxPlan
    console.log('[run-loop:runLoop] Loading settings from:', this.sandboxSettingsPath);
    await this.loadSettingsFrom(this.sandboxSettingsPath);
    console.log('[run-loop:runLoop] Settings reloaded');

    console.log('[run-loop:runLoop] Reading sandbox board...');
    const sandboxBoard = await this.workspace.readSandboxBoard();
    console.log('[run-loop:runLoop] Sandbox board tasks count:', sandboxBoard?.tasks?.length || 0);

    if (!sandboxBoard?.tasks?.length) {
      this.status = 'completed';
      this.reason = 'completed';
      await this.updateRun({ status: 'completed', lastMessage: 'No todo/in-progress tasks found', currentIteration: 0 });
      await this.appendSandboxLog('No pending tasks found in sandbox PRD. Exiting.');
      console.log('[run-loop:runLoop] No tasks found, exiting early');
      return;
    }

    try {
      console.log('[run-loop:runLoop] Running setup commands:', this.setupCommands.length);
      await this.workspace.runSetup(this.setupCommands, this.verifyCancellation.bind(this));
      console.log('[run-loop:runLoop] Setup completed');
    } catch (error) {
      console.error('[run-loop:runLoop] Setup failed:', error.message);
      if (error instanceof CancellationSignal || error.message?.includes('Cancellation')) {
        this.status = 'canceled';
        this.reason = 'canceled';
        await this.updateRun({ lastMessage: 'Setup canceled' });
        return;
      }
      throw error;
    }

    console.log('[run-loop:runLoop] Starting iterations, max:', this.run.maxIterations);
    for (let iteration = 1; iteration <= this.run.maxIterations; iteration += 1) {
      console.log(`[run-loop:runLoop] Iteration ${iteration}/${this.run.maxIterations}`);

      if (await this.verifyCancellation()) {
        console.log('[run-loop:runLoop] Cancellation detected');
        break;
      }

      await this.updateRun({
        currentIteration: iteration,
        lastTaskId: undefined,
        lastMessage: `Iteration ${iteration}: running ${this.agentName}`,
      });

      let result;
      try {
        console.log(`[run-loop:runLoop] Running agent iteration ${iteration}...`);
        result = await this.runAgentIteration(iteration);
        console.log(`[run-loop:runLoop] Agent iteration ${iteration} completed, exitCode:`, result.exitCode);
      } catch (error) {
        console.error(`[run-loop:runLoop] Agent iteration ${iteration} threw:`, error.message);
        if (error instanceof CancellationSignal) {
          this.status = 'canceled';
          this.reason = 'canceled';
          await this.appendSandboxLog('Run canceled during agent execution.');
          break;
        }
        throw error;
      }

      const { output, exitCode } = result;

      if (exitCode !== 0) {
        console.log(`[run-loop:runLoop] Agent exited with non-zero code: ${exitCode}`);
        if (exitCode === 2) {
          this.status = 'stopped';
          this.reason = 'usage_limit';
          await this.appendSandboxLog('Agent stopped: Usage limit reached. Stopping run.');
        } else {
          this.status = 'failed';
          this.reason = 'error';
          await this.appendSandboxLog(`Agent exited with code ${exitCode}. Stopping run.`);
        }
        break;
      }

      if (output?.includes('<promise>COMPLETE</promise>')) {
        console.log('[run-loop:runLoop] Received COMPLETE signal from agent');
        this.status = 'completed';
        this.reason = 'completed';
        await this.appendSandboxLog('Received <promise>COMPLETE</promise> from agent.');
        break;
      }
    }

    if (this.status === 'running') {
      console.log('[run-loop:runLoop] Max iterations reached');
      this.status = 'stopped';
      this.reason = 'max_iterations';
      await this.appendSandboxLog('Reached max iterations without completion.');
    }
    console.log('[run-loop:runLoop] runLoop finished with status:', this.status);
  }

  /**
   * Performs final cleanup and persists the final run state.
   * Implements the finalize workflow:
   * 1. Auto-save any uncommitted changes
   * 2. Push worktree branch to origin
   * 3. Create PR (if GitHub)
   * 4. Sync PRD back to main
   * 5. Delete worktree if push succeeded, otherwise leave for human review
   * @param {Error} [error] - The error that caused the loop to fail, if any.
   * @returns {Promise<void>}
   */
  async finalize(error) {
    try {
      await this.syncBackToRoot();
    } catch (syncError) {
      console.error('Failed to sync sandbox back to root', syncError);
    }

    try {
      await this.workspace.copyLogs(this.persistedLogPath);
    } catch (copyError) {
      console.error('Unable to archive sandbox log', copyError);
    }

    // Capture stats and update workspace
    let stats = { passed: 0, failed: 0 };
    try {
      stats = await this.workspace.captureSandboxStats();
    } catch (statsError) {
      console.error('Unable to capture sandbox stats', statsError);
    }

    // Run workspace finalization (auto-save, push, PR, cleanup)
    let prUrl = null;
    try {
      const result = await this.workspace.finalize();
      prUrl = result.prUrl;
    } catch (workspaceError) {
      console.error('Unable to finalize workspace', workspaceError);
    }

    const finishedAt = new Date().toISOString();
    const existingErrors = Array.isArray(this.run.errors) ? this.run.errors : [];
    const errorLines = [];
    if (error) {
      errorLines.push(error.message || String(error));
      if (error.stdout) errorLines.push(`Final stdout snippet: ${limitOutput(error.stdout, 500)}`);
      if (error.stderr) errorLines.push(`Final stderr snippet: ${limitOutput(error.stderr, 500)}`);
    }

    const finalRunState = {
      status: this.status,
      reason: this.reason,
      finishedAt,
      prUrl: prUrl || undefined,
      lastMessage: this.status === 'completed'
        ? 'Run completed'
        : `Run stopped (${this.reason})`,
      errors: [...existingErrors, ...errorLines],
    };
    await this.updateRun(finalRunState);

    const summaryLines = [
      `Run ${this.runId} finished with status ${this.status} (${this.reason}).`,
      `Agent: ${this.agentName}.`,
      `Passed: ${stats.passed}, Failed: ${stats.failed}.`,
    ];
    if (prUrl) {
      summaryLines.push(`PR: ${prUrl}`);
    }
    summaryLines.push(`Log: ${path.relative(this.projectPath, this.persistedLogPath)}`);
    summaryLines.push(`Details: plans/runs/${this.runId}.json`);

    const summary = summaryLines.join('\n');
    await this.appendRootProgress(summary);
  }
}

/**
 * CLI entry point.
 */
async function main() {
  console.log('[run-loop] Starting run-loop.mjs...');
  console.log('[run-loop] Node version:', process.version);
  console.log('[run-loop] Working directory:', process.cwd());
  console.log('[run-loop] Arguments:', process.argv.slice(2).join(' '));

  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    console.log('[run-loop] Parsed args:', JSON.stringify(args));
  } catch (parseError) {
    console.error('[run-loop] Failed to parse arguments:', parseError.message);
    process.exit(1);
  }

  const apiUrl = process.env.RUN_LOOP_API_URL || 'http://localhost:3000';
  const projectId = process.env.RUN_LOOP_PROJECT_ID;
  console.log('[run-loop] API URL:', apiUrl);
  console.log('[run-loop] Project ID:', projectId || '(not set)');
  console.log('[run-loop] Agent:', process.env.RUN_LOOP_AGENT || 'claude (default)');
  console.log('[run-loop] Agent bin:', process.env.RUN_LOOP_AGENT_BIN || '(not set)');
  console.log('[run-loop] Agent model:', process.env.RUN_LOOP_AGENT_MODEL || '(not set)');

  // Initialize backend client singleton - HTTP mode only
  try {
    initBackendClient({
      baseUrl: apiUrl,
      projectId: projectId,
    });
    console.log('[run-loop] Backend client initialized');
  } catch (initError) {
    console.error('[run-loop] Failed to initialize backend client:', initError.message);
    console.error(initError.stack);
    process.exit(1);
  }

  const runner = new RunLoop(args);
  console.log('[run-loop] RunLoop instance created');
  let finalized = false;

  try {
    console.log('[run-loop] Calling runner.init()...');
    await runner.init();
    console.log('[run-loop] runner.init() completed');

    console.log('[run-loop] Calling runner.runLoop()...');
    await runner.runLoop();
    console.log('[run-loop] runner.runLoop() completed with status:', runner.status);

    finalized = true;
    console.log('[run-loop] Calling runner.finalize()...');
    await runner.finalize();
    console.log('[run-loop] runner.finalize() completed');
    console.log('[run-loop] Run completed successfully');
  } catch (error) {
    console.error('[run-loop] Runner failed:', error.message);
    console.error('[run-loop] Error stack:', error.stack);
    if (error.stdout) console.error('[run-loop] stdout:', error.stdout);
    if (error.stderr) console.error('[run-loop] stderr:', error.stderr);

    runner.status = 'failed';
    runner.reason = runner.reason === 'completed' ? 'error' : runner.reason;
    if (!finalized) {
      try {
        console.log('[run-loop] Calling runner.finalize() after error...');
        await runner.finalize(error);
        console.log('[run-loop] runner.finalize() completed after error');
      } catch (finalizeError) {
        console.error('[run-loop] Critical failure in finalize during error handling:', finalizeError.message);
        console.error('[run-loop] Finalize error stack:', finalizeError.stack);
      }
    }
    process.exit(1);
  }
}

main();
