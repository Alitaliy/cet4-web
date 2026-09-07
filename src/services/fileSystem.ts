import { get, set, del } from 'idb-keyval';
import type { Storage } from './repository';

export class DirectoryStorage implements Storage {
  constructor(public handle: FileSystemDirectoryHandle) {}
  private async parent(path: string, create = false) {
    const parts = path.split('/');
    const name = parts.pop()!;
    let dir = this.handle;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    return { dir, name };
  }
  async read(path: string) {
    try {
      const { dir, name } = await this.parent(path);
      return await (await (await dir.getFileHandle(name)).getFile()).text();
    } catch (e) {
      if ((e as DOMException).name === 'NotFoundError') return null;
      throw e;
    }
  }
  async write(path: string, content: string) {
    const { dir, name } = await this.parent(path, true);
    const file = await dir.getFileHandle(name, { create: true });
    const stream = await file.createWritable();
    try {
      await stream.write(content);
      await stream.close();
    } catch (e) {
      await stream.abort().catch(() => {});
      throw e;
    }
  }
  async list(path: string) {
    try {
      let dir = this.handle;
      for (const part of path.split('/')) dir = await dir.getDirectoryHandle(part);
      const names: string[] = [];
      for await (const [name, entry] of dir.entries()) if (entry.kind === 'file') names.push(name);
      return names;
    } catch (e) {
      if ((e as DOMException).name === 'NotFoundError') return [];
      throw e;
    }
  }
  async remove(path: string) {
    const { dir, name } = await this.parent(path);
    await dir.removeEntry(name);
  }
}
export const supportsDirectory = () => 'showDirectoryPicker' in window;
export async function rememberDirectory(handle: FileSystemDirectoryHandle) {
  try {
    await set('cet4-directory', handle);
  } catch {
    /* Handle caching is optional. */
  }
}
export async function lastDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  try {
    return await get('cet4-directory');
  } catch {
    return undefined;
  }
}
export async function forgetDirectory() {
  try {
    await del('cet4-directory');
  } catch {
    /* optional preference */
  }
}
export async function withDirectoryLock<T>(fn: () => Promise<T>): Promise<T> {
  if (navigator.locks) return await navigator.locks.request('cet4-vocab-write', fn);
  return await fn();
}
