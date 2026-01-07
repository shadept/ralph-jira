import { LocalFilesystemAdapter } from './local-filesystem';

export function createStorage(projectPath: string) {
  return new LocalFilesystemAdapter(projectPath);
}

export type { StorageAdapter } from './interface';
export { LocalFilesystemAdapter } from './local-filesystem';
