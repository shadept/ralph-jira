import { LocalFilesystemAdapter } from './local-filesystem';
import { SQLiteStorageAdapter } from './sqlite-adapter';
import { StorageAdapter } from './interface';

export type StorageType = 'filesystem' | 'sqlite';

/**
 * Gets the storage type from environment variable.
 * Defaults to 'filesystem' for backwards compatibility.
 */
function getStorageTypeFromEnv(): StorageType {
  const envType = process.env.RALPH_STORAGE_TYPE;
  if (envType === 'sqlite') {
    return 'sqlite';
  }
  return 'filesystem';
}

/**
 * Creates a storage adapter based on the specified type or environment variable.
 * Defaults to 'filesystem' for backwards compatibility.
 *
 * Set RALPH_STORAGE_TYPE=sqlite to use SQLite storage.
 *
 * @param projectPath - The root path of the project
 * @param type - Storage type override (optional, defaults to env var or 'filesystem')
 * @param databaseUrl - Database URL for SQLite (optional, defaults to plans/ralph.db)
 */
export function createStorage(
  projectPath: string,
  type?: StorageType,
  databaseUrl?: string
): StorageAdapter {
  const effectiveType = type ?? getStorageTypeFromEnv();

  switch (effectiveType) {
    case 'sqlite':
      return new SQLiteStorageAdapter(projectPath, databaseUrl);
    case 'filesystem':
    default:
      return new LocalFilesystemAdapter(projectPath);
  }
}

export type { StorageAdapter } from './interface';
export { LocalFilesystemAdapter } from './local-filesystem';
export { SQLiteStorageAdapter } from './sqlite-adapter';
