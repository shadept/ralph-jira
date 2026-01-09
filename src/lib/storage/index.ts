import { LocalFilesystemAdapter } from './local-filesystem';
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
 */
export function createStorage(projectPath: string, type?: StorageType): StorageAdapter {
  const effectiveType = type ?? getStorageTypeFromEnv();

  switch (effectiveType) {
    case 'sqlite':
      throw new Error("Not yet implemented")
    case 'filesystem':
    default:
      return new LocalFilesystemAdapter(projectPath);
  }
}

export type { StorageAdapter } from './interface';
export { LocalFilesystemAdapter } from './local-filesystem';
