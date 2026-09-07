import {
  validateLibrary,
  reviewSchema,
  configSchema,
  DEFAULT_CONFIG,
  type Library,
  type Review,
  type Config,
} from '../models';
import { starterLibrary } from '../seed';

export interface Storage {
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  list(path: string): Promise<string[]>;
  remove(path: string): Promise<void>;
}
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function same(a: unknown, b: unknown) {
  return canonical(a) === canonical(b);
}
export class ConflictError extends Error {
  constructor() {
    super('检测到外部修改。请点击“重新加载”，查看最新数据后再保存；本次修改尚未写入。');
  }
}
type Journal = { schema_version: 1; before: Library | null; after: Library; reviews: Review[] };
export class Repository {
  constructor(public storage: Storage) {}
  private async current() {
    const text = await this.storage.read('data/words.json');
    return text === null ? null : validateLibrary(JSON.parse(text));
  }
  private async appendReviews(reviews: Review[]) {
    for (const month of new Set(reviews.map((r) => r.time.slice(0, 7)))) {
      const path = `data/reviews/${month}.jsonl`;
      const text = (await this.storage.read(path)) || '';
      const existing = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => reviewSchema.parse(JSON.parse(line)));
      const ids = new Set(existing.map((r) => r.id));
      const fresh = reviews.filter((r) => r.time.startsWith(month) && !ids.has(r.id));
      if (fresh.length)
        await this.storage.write(
          path,
          text +
            (text && !text.endsWith('\n') ? '\n' : '') +
            fresh.map((r) => JSON.stringify(r)).join('\n') +
            '\n',
        );
    }
  }
  async recover() {
    const raw = await this.storage.read('data/pending.json');
    if (!raw) return;
    const j = JSON.parse(raw) as Journal;
    if (j.schema_version !== 1 || !Array.isArray(j.reviews))
      throw new Error('存在无法识别的待恢复事务，请保留目录并检查 data/pending.json。');
    if (j.before !== null) validateLibrary(j.before);
    validateLibrary(j.after);
    j.reviews.forEach((r) => reviewSchema.parse(r));
    const disk = await this.current();
    if (same(disk, j.before)) await this.storage.write('data/words.json', json(j.after));
    else if (!same(disk, j.after))
      throw new Error(
        '未完成的保存与磁盘数据冲突。请保留 data/pending.json，使用备份人工核对后恢复。',
      );
    await this.appendReviews(j.reviews);
    await this.storage.remove('data/pending.json');
  }
  async load() {
    await this.recover();
    const library = await this.current();
    if (!library) throw new Error('目录还没有词库，请初始化此目录。');
    const reviews: Review[] = [];
    for (const name of (await this.storage.list('data/reviews'))
      .filter((n) => /^\d{4}-\d{2}\.jsonl$/.test(n))
      .sort()) {
      const raw = (await this.storage.read(`data/reviews/${name}`)) || '';
      for (const [i, line] of raw.split(/\r?\n/).entries())
        if (line.trim()) {
          try {
            reviews.push(reviewSchema.parse(JSON.parse(line)));
          } catch {
            throw new Error(`历史文件 ${name} 第 ${i + 1} 行损坏，请先修复后加载。`);
          }
        }
    }
    const rawConfig = await this.storage.read('data/config.json');
    const config = rawConfig ? configSchema.parse(JSON.parse(rawConfig)) : { ...DEFAULT_CONFIG };
    return { library, reviews, config };
  }
  async initialize() {
    await this.recover();
    if (await this.current()) return this.load();
    if (!(await this.storage.read('data/config.json')))
      await this.storage.write('data/config.json', json(DEFAULT_CONFIG));
    await this.storage.write(
      'data/meta.json',
      json({ schema_version: 1, created_at: new Date().toISOString(), app: 'cet4-vocab' }),
    );
    const library = starterLibrary();
    await this.storage.write(
      'data/pending.json',
      json({ schema_version: 1, before: null, after: library, reviews: [] }),
    );
    await this.recover();
    return this.load();
  }
  async backup(library?: Library) {
    const current = library || (await this.current());
    if (!current) throw new Error('没有可备份的词库。');
    const name = `words_${new Date().toISOString().replace(/[:.]/g, '-')}_${crypto.randomUUID().slice(0, 8)}.json`;
    await this.storage.write(`backups/${name}`, json(current));
    return name;
  }
  async save(
    expected: Library,
    next: Library,
    reviews: Review[] = [],
    source: Library['updated_by'] = 'web',
  ) {
    await this.recover();
    const disk = await this.current();
    if (!same(disk, expected)) throw new ConflictError();
    const after = validateLibrary({
      ...next,
      revision: expected.revision + 1,
      updated_at: new Date().toISOString(),
      updated_by: source,
    });
    reviews.forEach((r) => reviewSchema.parse(r));
    await this.backup(expected);
    if (!same(await this.current(), expected)) throw new ConflictError();
    await this.storage.write(
      'data/pending.json',
      json({ schema_version: 1, before: expected, after, reviews }),
    );
    await this.recover();
    // Backup retention is best effort AFTER a successful commit.
    try {
      const raw = await this.storage.read('data/config.json');
      const limit = raw ? configSchema.parse(JSON.parse(raw)).backup_limit : 30;
      const names = (await this.storage.list('backups'))
        .filter((n) => /^words_.*\.json$/.test(n))
        .sort()
        .reverse();
      for (const name of names.slice(limit)) await this.storage.remove(`backups/${name}`);
    } catch {
      /* A cleanup failure must not make a successful review look unsaved. */
    }
    return after;
  }
  async saveConfig(expected: Config, next: Config) {
    const current = await this.storage.read('data/config.json');
    if (current && !same(configSchema.parse(JSON.parse(current)), expected))
      throw new ConflictError();
    await this.storage.write('data/config.json', json(configSchema.parse(next)));
  }
  async listBackups() {
    return (await this.storage.list('backups'))
      .filter((n) => /^words_.*\.json$/.test(n))
      .sort()
      .reverse();
  }
  async restore(expected: Library, name: string) {
    if (!(await this.listBackups()).includes(name)) throw new Error('备份不存在。');
    const backup = validateLibrary(JSON.parse((await this.storage.read(`backups/${name}`))!));
    return this.save(expected, backup);
  }
}
