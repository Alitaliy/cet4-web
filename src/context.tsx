import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_CONFIG,
  configSchema,
  validateLibrary,
  type Library,
  type Review,
  type Config,
} from './models';
import { demoData } from './seed';
import { Repository } from './services/repository';
import {
  DirectoryStorage,
  rememberDirectory,
  lastDirectory,
  forgetDirectory,
  withDirectoryLock,
} from './services/fileSystem';

type Mode = 'demo' | 'folder' | 'portable';
function useStore() {
  const [initial] = useState(demoData);
  const [library, setLibrary] = useState(initial.library);
  const [reviews, setReviews] = useState(initial.reviews);
  const [config, setConfig] = useState<Config>({ ...DEFAULT_CONFIG });
  const [mode, setMode] = useState<Mode>('demo');
  const [directory, setDirectory] = useState('');
  const [recent, setRecent] = useState<FileSystemDirectoryHandle>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const repo = useRef<Repository | null>(null);
  useEffect(() => {
    void lastDirectory().then(setRecent);
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    const fn = (event: BeforeUnloadEvent) => {
      if (dirty && mode === 'portable') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty, mode]);
  async function run(task: () => Promise<void>): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
      return true;
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError')
        setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function connect(resume = false) {
    return run(async () => {
      if (mode === 'portable' && dirty)
        throw new Error('手动模式有未导出的数据，请先导出学习存档，再连接目录。');
      const handle =
        resume && recent
          ? recent
          : await window.showDirectoryPicker({ mode: 'readwrite', id: 'cet4-vocab' });
      if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted')
        throw new Error('未获得目录读写权限，请重新授权。');
      const next = new Repository(new DirectoryStorage(handle));
      const data = await withDirectoryLock(() => next.initialize());
      repo.current = next;
      setLibrary(data.library);
      setReviews(data.reviews);
      setConfig(data.config);
      setDirectory(handle.name);
      setMode('folder');
      setDirty(false);
      await rememberDirectory(handle);
      setRecent(handle);
      setNotice(`已连接 ${handle.name}，保存会直接写入此目录。`);
    });
  }
  async function reload() {
    return run(async () => {
      if (!repo.current) return;
      const data = await withDirectoryLock(() => repo.current!.load());
      setLibrary(data.library);
      setReviews(data.reviews);
      setConfig(data.config);
      setNotice('已读取最新词库和学习记录。');
    });
  }
  async function commit(
    next: Library,
    added: Review[] = [],
    message = '修改已保存',
    source: Library['updated_by'] = 'web',
  ) {
    return run(async () => {
      if (repo.current) {
        const saved = await withDirectoryLock(() =>
          repo.current!.save(library, next, added, source),
        );
        setLibrary(saved);
      } else {
        setLibrary(
          validateLibrary({
            ...next,
            revision: library.revision + 1,
            updated_at: new Date().toISOString(),
            updated_by: source,
          }),
        );
        setDirty(true);
      }
      setReviews((old) => [...old, ...added]);
      setNotice(
        mode === 'folder'
          ? message
          : mode === 'demo'
            ? '已更新演示，数据仅保留在本次会话。'
            : '已更新，请在离开前导出学习存档。',
      );
    });
  }
  async function saveConfig(next: Config) {
    return run(async () => {
      configSchema.parse(next);
      if (repo.current) await withDirectoryLock(() => repo.current!.saveConfig(config, next));
      setConfig(next);
      if (mode === 'portable') setDirty(true);
      setNotice(mode === 'folder' ? '学习设置已保存。' : '设置已在本次会话生效。');
    });
  }
  async function disconnect() {
    return run(async () => {
      repo.current = null;
      await forgetDirectory();
      setRecent(undefined);
      const demo = demoData();
      setLibrary(demo.library);
      setReviews(demo.reviews);
      setConfig({ ...DEFAULT_CONFIG });
      setMode('demo');
      setDirectory('');
      setDirty(false);
      setNotice('已断开目录，切换到演示词库。');
    });
  }
  function usePortable(next: Library, history: Review[] = [], preferences?: Config) {
    repo.current = null;
    setLibrary(validateLibrary(next));
    setReviews(history);
    setConfig(preferences ? configSchema.parse(preferences) : { ...DEFAULT_CONFIG });
    setMode('portable');
    setDirectory('');
    setDirty(true);
    setError('');
    setNotice('已载入手动模式，完成学习后请导出存档。');
  }
  return {
    library,
    reviews,
    config,
    mode,
    directory,
    recent,
    busy,
    error,
    notice,
    dirty,
    repo,
    run,
    connect,
    reload,
    commit,
    saveConfig,
    disconnect,
    usePortable,
    setDirty,
    setError,
    setNotice,
  };
}
const Store = createContext<ReturnType<typeof useStore> | null>(null);
export function VocabularyProvider({ children }: { children: ReactNode }) {
  const value = useStore();
  return <Store.Provider value={value}>{children}</Store.Provider>;
}
export function useVocabulary() {
  return useContext(Store)!;
}
