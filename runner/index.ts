#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { LocalFilesystemAdapter } from '../src/lib/storage/local-filesystem.js';
import { Board, Task, ProjectSettings } from '../src/lib/schemas.js';
import { projectRegistry } from '../src/lib/projects/registry.js';

interface RunnerProject {
  id: string;
  name: string;
  path: string;
}

let storage: LocalFilesystemAdapter;

async function setupStorage(projectId?: string): Promise<RunnerProject> {
  const project = await projectRegistry.getProjectOrDefault(projectId);
  storage = new LocalFilesystemAdapter(project.path);
  return project;
}

interface RunnerOptions {
  boardId: string;
  maxIterations?: number;
  dryRun?: boolean;
  projectId?: string;
}

interface TaskAttempt {
  taskId: string;
  description: string;
  result: 'pass' | 'fail' | 'skipped';
  filesChanged: string[];
  commands: string[];
  output: string;
}

class AIRunner {
  private settings!: ProjectSettings;
  private board!: Board;
  private runId: string;
  private options: RunnerOptions;
  private tasksAttempted: TaskAttempt[] = [];
  private projectName: string;
  private workspacePath: string;

  constructor(options: RunnerOptions, project: RunnerProject) {
    this.runId = `run-${Date.now()}`;
    this.options = options;
    this.projectName = project.name;
    this.workspacePath = project.path;
  }

  async init() {
    this.settings = await storage.readSettings();
    this.board = await storage.readBoard(this.options.boardId);
    await this.log(`\n${'='.repeat(80)}\nRun ID: ${this.runId}\nProject: ${this.projectName}\nBoard: ${this.board.name}\nGoal: ${this.board.goal}\n${'='.repeat(80)}`);
  }

  private async log(message: string) {
    console.log(message);
    if (!this.options.dryRun) {
      await storage.appendProgress(message);
    }
  }

  private async executeCommand(command: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
    try {
        const output = execSync(command, {
          cwd: this.workspacePath,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024 * 10, // 10MB
        });

      return { stdout: output, stderr: '', success: true };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message || 'Command failed',
        success: false,
      };
    }
  }

  private getNextTask(): Task | null {
    // Priority order: in_progress > todo > backlog
    // Filter: status !== 'done' AND passes === false

    const candidates = this.board.tasks.filter(
      t => t.status !== 'done' && !t.passes
    );

    const inProgress = candidates.find(t => t.status === 'in_progress');
    if (inProgress) return inProgress;

    const todo = candidates.find(t => t.status === 'todo');
    if (todo) return todo;

    const backlog = candidates.find(t => t.status === 'backlog');
    if (backlog) return backlog;

    return null;
  }

  private async updateTask(task: Task, updates: Partial<Task>) {
    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    await storage.writeBoard(this.board);
  }

  private async executeTask(task: Task): Promise<TaskAttempt> {
    await this.log(`\n--- Task: ${task.id} ---`);
    await this.log(`Description: ${task.description}`);
    await this.log(`Priority: ${task.priority} | Estimate: ${task.estimate || 'N/A'} pts`);
    await this.log(`\nAcceptance Steps:`);
    task.steps.forEach((step, idx) => {
      this.log(`  ${idx + 1}. ${step}`);
    });

    const attempt: TaskAttempt = {
      taskId: task.id,
      description: task.description,
      result: 'fail',
      filesChanged: [],
      commands: [],
      output: '',
    };

    try {
      // Mark as in progress
      await this.updateTask(task, { status: 'in_progress', lastRun: new Date().toISOString() });

      // Use AI to plan implementation
      await this.log(`\nPlanning implementation with AI...`);

      const planResult = await generateText({
        model: openai(this.settings.aiPreferences.defaultModel),
        prompt: `You are an expert software engineer implementing a task.

Project: ${this.settings.projectName}
Tech Stack: ${this.settings.techStack.join(', ')}
Coding Style: ${this.settings.codingStyle}

Task: ${task.description}
Category: ${task.category}

Acceptance Criteria:
${task.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Create a detailed implementation plan:
1. List specific files that need to be created or modified
2. Describe what changes are needed in each file
3. Identify any dependencies or prerequisites
4. List commands to run for testing

Be specific and actionable. Focus on meeting the acceptance criteria.`,
      });

      const plan = planResult.text;
      await this.log(`\nImplementation Plan:`);
      await this.log(plan);

      // For now, we'll simulate file changes and test execution
      // In a full implementation, you would use tools to actually modify files

      await this.log(`\n[NOTE: File modification capability is scaffolded. In production, this would:`);
      await this.log(`  - Parse the AI plan to extract file changes`);
      await this.log(`  - Use code generation to create/modify files`);
      await this.log(`  - Apply changes atomically`);
      await this.log(`  - Track all modified files]`);

      // Run tests
      await this.log(`\nRunning tests...`);
      const testResults: string[] = [];

      for (const command of this.settings.howToTest.commands) {
        await this.log(`\n> ${command}`);
        attempt.commands.push(command);

        const result = await this.executeCommand(command);
        const output = result.stdout + result.stderr;
        const trimmedOutput = output.length > 500
          ? output.substring(0, 500) + '\n...(output trimmed)...'
          : output;

        await this.log(trimmedOutput);
        testResults.push(output);

        if (!result.success) {
          await this.log(`\n❌ Test failed`);
          attempt.result = 'fail';
          attempt.output = output;

          await this.updateTask(task, {
            status: 'review',
            passes: false,
            failureNotes: `Tests failed: ${command}\n${trimmedOutput}`,
          });

          return attempt;
        }
      }

      // All tests passed
      await this.log(`\n✅ All tests passed`);
      attempt.result = 'pass';
      attempt.output = testResults.join('\n---\n');

      await this.updateTask(task, {
        status: 'done',
        passes: true,
        failureNotes: undefined,
      });

    } catch (error) {
      await this.log(`\n❌ Error during task execution: ${error}`);
      attempt.result = 'fail';
      attempt.output = String(error);

      await this.updateTask(task, {
        status: 'review',
        passes: false,
        failureNotes: `Runner error: ${error}`,
      });
    }

    return attempt;
  }

  async run() {
    await this.init();

    const maxIterations = this.options.maxIterations || 25;
    let iteration = 0;

    while (iteration < maxIterations) {
      const task = this.getNextTask();

      if (!task) {
        await this.log(`\n\n🎉 All tasks completed!`);
        break;
      }

      iteration++;
      await this.log(`\n\nIteration ${iteration}/${maxIterations}`);

      const attempt = await this.executeTask(task);
      this.tasksAttempted.push(attempt);

      if (attempt.result === 'fail') {
        await this.log(`\nTask failed. Moving to next task...`);
      }
    }

    if (iteration >= maxIterations) {
      await this.log(`\n\n⚠️ Reached maximum iterations (${maxIterations})`);
    }

    // Save run log
    await storage.writeRunLog({
      runId: this.runId,
      boardId: this.options.boardId,
      startTime: new Date(parseInt(this.runId.replace('run-', ''))).toISOString(),
      endTime: new Date().toISOString(),
      tasksAttempted: this.tasksAttempted,
      status: 'completed',
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
      },
    });

    await this.log(`\n\nRun Summary:`);
    await this.log(`  Total attempts: ${this.tasksAttempted.length}`);
    await this.log(`  Passed: ${this.tasksAttempted.filter(t => t.result === 'pass').length}`);
    await this.log(`  Failed: ${this.tasksAttempted.filter(t => t.result === 'fail').length}`);
    await this.log(`\nRun log saved: plans/runs/${this.runId}.json`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  const options: RunnerOptions = {
    boardId: 'prd',
    maxIterations: 25,
    dryRun: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--board' && i + 1 < args.length) {
      options.boardId = args[++i];
    } else if (arg === '--project' && i + 1 < args.length) {
      options.projectId = args[++i];
    } else if (arg === '--max-iterations' && i + 1 < args.length) {
      options.maxIterations = parseInt(args[++i], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help') {
      console.log(`
AI Task Runner

Usage: npm run pm:run [options]

Options:
  --board <id>              Board ID to run (default: prd)
  --project <id>            Project ID from the dashboard (default: current workspace)
  --max-iterations <n>      Maximum task attempts (default: 25)
  --dry-run                 Run without making changes
  --help                    Show this help message

Environment Variables:
  OPENAI_API_KEY            OpenAI API key (required)

Examples:
  npm run pm:run
  npm run pm:run --board prd --max-iterations 10
  node runner/index.js --board sprint-1
      `);
      process.exit(0);
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable not set');
    process.exit(1);
  }

  const project = await setupStorage(options.projectId);
  const runner = new AIRunner(options, project);
  await runner.run();
}

main().catch(console.error);
