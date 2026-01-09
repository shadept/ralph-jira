import { promises as fs } from 'fs';
import path from 'path';

const TEMPLATE_SETTINGS = path.join(process.cwd(), 'plans', 'settings.json');
const TEMPLATE_BOARD = path.join(process.cwd(), 'plans', 'prd.json');

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyTemplate(source: string, destination: string, fallback: string) {
  if (await fileExists(destination)) return;

  try {
    const content = await fs.readFile(source, 'utf-8');
    await fs.writeFile(destination, content, 'utf-8');
  } catch {
    await fs.writeFile(destination, fallback, 'utf-8');
  }
}

export async function initializeProjectStructure(projectPath: string) {
  const absolutePath = path.resolve(projectPath);
  const plansDir = path.join(absolutePath, 'plans');
  const runsDir = path.join(plansDir, 'runs');
  const progressFile = path.join(absolutePath, 'progress.txt');

  await ensureDirectory(absolutePath);
  await ensureDirectory(plansDir);
  await ensureDirectory(runsDir);

  const defaultSettings = {
    projectName: 'New Project',
    projectDescription: 'Describe your project goals and constraints.',
    techStack: [],
    howToTest: {
      commands: [],
      notes: '',
    },
    howToRun: {
      commands: [],
      notes: '',
    },
    aiPreferences: {
      defaultModel: 'gpt-4-turbo',
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 4000,
      guardrails: [],
    },
    repoConventions: {
      folders: {},
      naming: '',
      commitStyle: '',
    },
    automation: {
      codingStyle: 'Write clean, maintainable code.',
      setup: [],
      maxIterations: 5,
      agent: {
        name: 'claude',
        model: 'opus-4.5',
        permissionMode: 'bypassPermissions',
        extraArgs: [],
      },
    },
  };

  await copyTemplate(
    TEMPLATE_SETTINGS,
    path.join(plansDir, 'settings.json'),
    JSON.stringify(defaultSettings, null, 2)
  );

  const defaultBoard = {
    id: 'initial-sprint',
    name: 'Initial Sprint',
    goal: 'Kick off the project',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'planned',
    columns: [
      { id: 'backlog', name: 'Backlog', order: 0 },
      { id: 'todo', name: 'To Do', order: 1 },
      { id: 'in_progress', name: 'In Progress', order: 2 },
      { id: 'review', name: 'Review', order: 3 },
      { id: 'done', name: 'Done', order: 4 },
    ],
    tasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: { velocity: 0, completed: 0, total: 0 },
  };

  await copyTemplate(
    TEMPLATE_BOARD,
    path.join(plansDir, 'prd.json'),
    JSON.stringify(defaultBoard, null, 2)
  );

  if (!(await fileExists(progressFile))) {
    await fs.writeFile(progressFile, '# Project Progress Log\n', 'utf-8');
  }
}

export async function backupPlansDirectory(projectPath: string): Promise<string | null> {
  const absolutePath = path.resolve(projectPath);
  const plansDir = path.join(absolutePath, 'plans');

  if (!(await fileExists(plansDir))) {
    return null;
  }

  const backupDir = path.join(absolutePath, `plans_backup_${Date.now()}`);
  await fs.rename(plansDir, backupDir);
  return backupDir;
}

export function resolveProjectPath(targetPath: string): string {
  return path.resolve(targetPath);
}
