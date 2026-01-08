import { Board, ProjectSettings, RunLog } from '../schemas';

export interface StorageAdapter {
  // Board operations
  readBoard(boardId: string): Promise<Board>;
  writeBoard(board: Board): Promise<void>;
  listBoards(): Promise<string[]>;
  deleteBoard(boardId: string): Promise<void>;

  // Settings operations
  readSettings(): Promise<ProjectSettings>;
  writeSettings(settings: ProjectSettings): Promise<void>;

  // Progress log operations
  appendProgress(entry: string): Promise<void>;
  readProgress(): Promise<string>;

  // Run log operations
  writeRunLog(log: RunLog): Promise<void>;
  readRunLog(runId: string): Promise<RunLog>;
  listRunLogs(): Promise<string[]>;

  // File operations (for file viewer)
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(pattern: string): Promise<string[]>;

  // Project context operations
  readProjectReadme(): Promise<string | null>;
}
