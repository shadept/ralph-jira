import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import {
  Board,
  ProjectSettings,
  RunLog,
  BoardSchema,
  ProjectSettingsSchema,
  RunLogSchema,
  Column,
  Task,
} from '../schemas';
import { StorageAdapter } from './interface';

/**
 * SQLite storage adapter using Prisma ORM.
 * Stores all data in a SQLite database file.
 */
export class SQLiteStorageAdapter implements StorageAdapter {
  private prisma: PrismaClient;
  private repoRoot: string;
  private initialized: boolean = false;

  constructor(repoRoot: string = process.cwd(), databaseUrl?: string) {
    this.repoRoot = repoRoot;

    // Default database URL if not provided
    const dbUrl = databaseUrl || `file:${path.join(repoRoot, 'plans', 'ralph.db')}`;

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  }

  /**
   * Ensures the database is connected and ready.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await this.prisma.$connect();
    this.initialized = true;
  }

  /**
   * Disconnects from the database. Call this when done with the adapter.
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    this.initialized = false;
  }

  // Board operations

  async readBoard(boardId: string): Promise<Board> {
    await this.ensureInitialized();

    // Map various IDs to actual board lookup
    const isActiveBoard = boardId === 'active' || boardId === 'prd' || boardId === 'initial-sprint';

    let board;
    if (isActiveBoard) {
      // Find the first active or any board if no active
      board = await this.prisma.board.findFirst({
        where: { status: 'active' },
        include: { columns: true, tasks: true },
      });

      if (!board) {
        board = await this.prisma.board.findFirst({
          include: { columns: true, tasks: true },
        });
      }
    } else {
      board = await this.prisma.board.findUnique({
        where: { id: boardId },
        include: { columns: true, tasks: true },
      });
    }

    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }

    return this.dbBoardToSchema(board);
  }

  async writeBoard(board: Board): Promise<void> {
    await this.ensureInitialized();

    const validated = BoardSchema.parse(board);

    // Upsert the board
    await this.prisma.board.upsert({
      where: { id: validated.id },
      create: {
        id: validated.id,
        name: validated.name,
        goal: validated.goal,
        deadline: new Date(validated.deadline),
        status: validated.status,
        metricsJson: validated.metrics ? JSON.stringify(validated.metrics) : null,
        createdAt: new Date(validated.createdAt),
        updatedAt: new Date(validated.updatedAt),
      },
      update: {
        name: validated.name,
        goal: validated.goal,
        deadline: new Date(validated.deadline),
        status: validated.status,
        metricsJson: validated.metrics ? JSON.stringify(validated.metrics) : null,
        updatedAt: new Date(validated.updatedAt),
      },
    });

    // Delete existing columns and tasks, then recreate
    await this.prisma.column.deleteMany({ where: { boardId: validated.id } });
    await this.prisma.task.deleteMany({ where: { boardId: validated.id } });

    // Create columns
    if (validated.columns.length > 0) {
      await this.prisma.column.createMany({
        data: validated.columns.map((col) => ({
          columnId: col.id,
          name: col.name,
          order: col.order,
          boardId: validated.id,
        })),
      });
    }

    // Create tasks
    if (validated.tasks.length > 0) {
      await this.prisma.task.createMany({
        data: validated.tasks.map((task) => ({
          id: task.id,
          category: task.category,
          description: task.description,
          acceptanceCriteriaJson: JSON.stringify(task.acceptanceCriteria),
          passes: task.passes,
          status: task.status,
          priority: task.priority,
          estimate: task.estimate,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          tagsJson: JSON.stringify(task.tags),
          assignee: task.assignee,
          filesTouchedJson: JSON.stringify(task.filesTouched),
          lastRun: task.lastRun ? new Date(task.lastRun) : null,
          failureNotes: task.failureNotes,
          boardId: validated.id,
        })),
      });
    }
  }

  async listBoards(): Promise<string[]> {
    await this.ensureInitialized();

    const boards = await this.prisma.board.findMany({
      select: { id: true },
    });

    return boards.map((b) => b.id);
  }

  async deleteBoard(boardId: string): Promise<void> {
    await this.ensureInitialized();

    await this.prisma.board.delete({
      where: { id: boardId },
    });
  }

  // Settings operations

  async readSettings(): Promise<ProjectSettings> {
    await this.ensureInitialized();

    const settings = await this.prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      throw new Error('Settings not found');
    }

    const data: ProjectSettings = {
      projectName: settings.projectName,
      projectDescription: settings.projectDescription,
      techStack: JSON.parse(settings.techStackJson),
      howToTest: JSON.parse(settings.howToTestJson),
      howToRun: JSON.parse(settings.howToRunJson),
      aiPreferences: JSON.parse(settings.aiPreferencesJson),
      repoConventions: JSON.parse(settings.repoConventionsJson),
      automation: settings.automationJson ? JSON.parse(settings.automationJson) : undefined,
    };

    return ProjectSettingsSchema.parse(data);
  }

  async writeSettings(settings: ProjectSettings): Promise<void> {
    await this.ensureInitialized();

    const validated = ProjectSettingsSchema.parse(settings);

    await this.prisma.settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        projectName: validated.projectName,
        projectDescription: validated.projectDescription,
        techStackJson: JSON.stringify(validated.techStack),
        howToTestJson: JSON.stringify(validated.howToTest),
        howToRunJson: JSON.stringify(validated.howToRun),
        aiPreferencesJson: JSON.stringify(validated.aiPreferences),
        repoConventionsJson: JSON.stringify(validated.repoConventions),
        automationJson: validated.automation ? JSON.stringify(validated.automation) : null,
      },
      update: {
        projectName: validated.projectName,
        projectDescription: validated.projectDescription,
        techStackJson: JSON.stringify(validated.techStack),
        howToTestJson: JSON.stringify(validated.howToTest),
        howToRunJson: JSON.stringify(validated.howToRun),
        aiPreferencesJson: JSON.stringify(validated.aiPreferences),
        repoConventionsJson: JSON.stringify(validated.repoConventions),
        automationJson: validated.automation ? JSON.stringify(validated.automation) : null,
      },
    });
  }

  // Progress log operations

  async appendProgress(entry: string): Promise<void> {
    await this.ensureInitialized();

    await this.prisma.progress.create({
      data: {
        entry,
      },
    });
  }

  async readProgress(): Promise<string> {
    await this.ensureInitialized();

    const entries = await this.prisma.progress.findMany({
      orderBy: { createdAt: 'asc' },
    });

    if (entries.length === 0) {
      return '# Project Progress Log\n';
    }

    const header = '# Project Progress Log\n';
    const content = entries
      .map((e) => `\n[${e.createdAt.toISOString()}]\n${e.entry}\n`)
      .join('');

    return header + content;
  }

  // Run log operations

  async writeRunLog(log: RunLog): Promise<void> {
    await this.ensureInitialized();

    const validated = RunLogSchema.parse(log);

    await this.prisma.runLog.upsert({
      where: { runId: validated.runId },
      create: {
        runId: validated.runId,
        boardId: validated.boardId,
        startTime: new Date(validated.startTime),
        endTime: validated.endTime ? new Date(validated.endTime) : null,
        tasksAttemptedJson: JSON.stringify(validated.tasksAttempted),
        status: validated.status,
        environmentJson: validated.environment ? JSON.stringify(validated.environment) : null,
      },
      update: {
        boardId: validated.boardId,
        startTime: new Date(validated.startTime),
        endTime: validated.endTime ? new Date(validated.endTime) : null,
        tasksAttemptedJson: JSON.stringify(validated.tasksAttempted),
        status: validated.status,
        environmentJson: validated.environment ? JSON.stringify(validated.environment) : null,
      },
    });
  }

  async readRunLog(runId: string): Promise<RunLog> {
    await this.ensureInitialized();

    const log = await this.prisma.runLog.findUnique({
      where: { runId },
    });

    if (!log) {
      throw new Error(`Run log not found: ${runId}`);
    }

    const data: RunLog = {
      runId: log.runId,
      boardId: log.boardId,
      startTime: log.startTime.toISOString(),
      endTime: log.endTime?.toISOString(),
      tasksAttempted: JSON.parse(log.tasksAttemptedJson),
      status: log.status as RunLog['status'],
      environment: log.environmentJson ? JSON.parse(log.environmentJson) : undefined,
    };

    return RunLogSchema.parse(data);
  }

  async listRunLogs(): Promise<string[]> {
    await this.ensureInitialized();

    const logs = await this.prisma.runLog.findMany({
      select: { runId: true },
    });

    return logs.map((l) => l.runId);
  }

  // File operations - these still use filesystem since they deal with actual code files

  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.repoRoot, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.repoRoot, filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async listFiles(pattern: string): Promise<string[]> {
    const dir = pattern.includes('*') ? pattern.split('*')[0] : pattern;
    const fullPath = path.join(this.repoRoot, dir);

    try {
      const files = await fs.readdir(fullPath);
      return files;
    } catch {
      return [];
    }
  }

  async readProjectReadme(): Promise<string | null> {
    const readmeNames = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];

    for (const name of readmeNames) {
      try {
        const content = await fs.readFile(path.join(this.repoRoot, name), 'utf-8');
        return content;
      } catch {
        // Try next name
      }
    }

    return null;
  }

  // Helper methods

  private dbBoardToSchema(
    board: {
      id: string;
      name: string;
      goal: string;
      deadline: Date;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      metricsJson: string | null;
      columns: Array<{ columnId: string; name: string; order: number }>;
      tasks: Array<{
        id: string;
        category: string;
        description: string;
        acceptanceCriteriaJson: string;
        passes: boolean;
        status: string;
        priority: string;
        estimate: number | null;
        createdAt: Date;
        updatedAt: Date;
        tagsJson: string;
        assignee: string | null;
        filesTouchedJson: string;
        lastRun: Date | null;
        failureNotes: string | null;
      }>;
    }
  ): Board {
    const columns: Column[] = board.columns.map((col) => ({
      id: col.columnId,
      name: col.name,
      order: col.order,
    }));

    const tasks: Task[] = board.tasks.map((task) => ({
      id: task.id,
      category: task.category,
      description: task.description,
      acceptanceCriteria: JSON.parse(task.acceptanceCriteriaJson),
      passes: task.passes,
      status: task.status,
      priority: task.priority as Task['priority'],
      estimate: task.estimate ?? undefined,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      tags: JSON.parse(task.tagsJson),
      assignee: task.assignee ?? undefined,
      filesTouched: JSON.parse(task.filesTouchedJson),
      lastRun: task.lastRun?.toISOString(),
      failureNotes: task.failureNotes ?? undefined,
    }));

    const metrics = board.metricsJson ? JSON.parse(board.metricsJson) : undefined;

    return BoardSchema.parse({
      id: board.id,
      name: board.name,
      goal: board.goal,
      deadline: board.deadline.toISOString(),
      status: board.status,
      columns,
      tasks,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
      metrics,
    });
  }
}
