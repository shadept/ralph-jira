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
const DEFAULT_SETUP = ['npm ci'];

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
    this.run = null;
    this.sandboxDir = null;
    this.sandboxBoardPath = null;
    this.rootBoardPath = null;
    this.sandboxLogPath = null;
    this.persistedLogPath = null;
    this.cancelFlagPath = null;
    this.settings = null;
    this.passed = 0;
    this.failed = 0;
    this.reason = 'completed';
    this.status = 'completed';
    this.agentName = (process.env.RUN_LOOP_AGENT || 'claude').toLowerCase();
    this.agentBin = process.env.RUN_LOOP_AGENT_BIN || this.agentName;
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
    this.settings = await readJson(this.settingsPath);
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

  async ensureSandboxBase() {
    await fs.mkdir(path.dirname(this.sandboxDir), { recursive: true });
    if (await fileExists(this.sandboxDir)) {
      await fs.rm(this.sandboxDir, { recursive: true, force: true });
    }
  }

  async checkoutWorkspace() {
    await this.ensureSandboxBase();
    const cloneArgs = ['clone', '--local', this.projectPath, this.sandboxDir];
    try {
      await this.runCommand('git', cloneArgs, this.projectPath);
    } catch (error) {
      console.warn('git clone --local failed, falling back to fs copy', error.message || error);
      await fs.cp(this.projectPath, this.sandboxDir, {
        recursive: true,
        filter: source => {
          const rel = path.relative(this.projectPath, source);
          if (!rel) return true;
          if (rel.startsWith('.git')) return false;
          if (rel.startsWith('.pm')) return false;
          if (rel.startsWith(`plans${path.sep}runs`)) return false;
          if (rel.startsWith('node_modules')) return false;
          if (rel.startsWith('.next')) return false;
          return true;
        },
      });
    }
  }

  async prepareSandboxPlan() {
    const board = await readJson(this.rootBoardPath);
    const filteredTasks = board.tasks.filter(task => PENDING_STATUSES.has(task.status));
    const sandboxBoard = { ...board, tasks: filteredTasks };
    await fs.mkdir(path.dirname(this.sandboxBoardPath), { recursive: true });
    await writeJson(this.sandboxBoardPath, sandboxBoard);
    const sandboxSettingsPath = path.join(this.sandboxDir, 'plans', 'settings.json');
    await fs.copyFile(this.settingsPath, sandboxSettingsPath);
    await fs.writeFile(this.sandboxLogPath, `# Run ${this.runId} progress\n`, 'utf-8');
  }

  getSetupCommands() {
    const commands = this.settings.automation?.setup;
    if (Array.isArray(commands) && commands.length) return commands;
    return DEFAULT_SETUP;
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
    const extraArgs = this.agentExtraArgs;
    if (this.agentName === 'opencode') {
      return {
        command: this.agentBin,
        args: [...extraArgs, '-p', prompt],
        prompt,
      };
    }

    if (this.agentName === 'claude') {
      return {
        command: this.agentBin,
        args: [...extraArgs, '--permission-mode', this.claudePermissionMode, '-p', prompt],
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
        lastTaskId: null,
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
