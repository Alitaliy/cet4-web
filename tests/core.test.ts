import { describe, it, expect } from 'vitest';
import { applyReview, buildQueue } from '../src/algorithms';
import {
  newWord,
  emptyLibrary,
  DEFAULT_CONFIG,
  validateLibrary,
  localDay,
  addDays,
  type Library,
} from '../src/models';
import { Repository, ConflictError, type Storage } from '../src/services/repository';
import { parseImport, exportCSV, mergeWords } from '../src/services/importExport';
import { starterLibrary } from '../src/seed';

class MemoryStorage implements Storage {
  files = new Map<string, string>();
  failOn = '';
  async read(path: string) {
    return this.files.get(path) ?? null;
  }
  async write(path: string, content: string) {
    if (path === this.failOn) throw new Error('disk disconnected');
    this.files.set(path, content);
  }
  async list(path: string) {
    return [...this.files.keys()]
      .filter((k) => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/'))
      .map((k) => k.slice(path.length + 1));
  }
  async remove(path: string) {
    this.files.delete(path);
  }
}

describe('review scheduling', () => {
  it('uses the full interval ladder, caps slow answers, and resets a lapse', () => {
    let w = newWord('maintain', '保持');
    for (const interval of [1, 2, 4, 7, 15, 30, 60]) {
      w = applyReview(w, 'correct', '保持', 1200, DEFAULT_CONFIG).word;
      expect(w.schedule.interval_days).toBe(interval);
    }
    expect(w.status).toBe('mastered');
    w = applyReview(w, 'correct', '保持', 9000, DEFAULT_CONFIG).word;
    expect(w.status).toBe('learning');
    expect(w.schedule.interval_days).toBe(4);
    w = applyReview(w, 'unknown', '', null, DEFAULT_CONFIG).word;
    expect(w.stats.streak).toBe(0);
    expect(w.stats.wrong).toBe(1);
    expect(w.stats.lapses).toBe(1);
    expect(w.schedule.due_at).toBe(addDays(localDay(), 1));
  });
  it('does not dilute measured response averages with untimed Skill reviews', () => {
    let w = newWord('test', '测试');
    w = applyReview(w, 'correct', '测试', 1000, DEFAULT_CONFIG).word;
    for (let i = 0; i < 4; i++) w = applyReview(w, 'correct', '测试', null, DEFAULT_CONFIG).word;
    w = applyReview(w, 'fuzzy', '测试', 3000, DEFAULT_CONFIG).word;
    expect(w.stats.avg_response_ms).toBe(2000);
    expect(w.stats.response_count).toBe(2);
    expect(w.stats.streak).toBe(0);
  });
  it('deduplicates pool overlap and excludes suspended / future stable words', () => {
    const words = Object.values(starterLibrary().words);
    words.forEach((w, i) => {
      if (i < 10) {
        w.status = 'confusing';
        w.stats.wrong = 3;
      } else if (i < 20) {
        w.status = 'suspended';
      } else if (i < 30) {
        w.status = 'mastered';
        w.schedule.due_at = addDays(localDay(), 30);
      }
    });
    const q = buildQueue(words, 40);
    expect(new Set(q.map((w) => w.word)).size).toBe(q.length);
    expect(q).toHaveLength(28);
    expect(q.every((w) => w.status !== 'suspended' && w.status !== 'mastered')).toBe(true);
  });
});

describe('repository safety', () => {
  it('initializes once, excludes demo history, and validates before writing', async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    const initial = await repo.initialize();
    expect(Object.keys(initial.library.words)).toHaveLength(48);
    expect(initial.reviews).toEqual([]);
    expect(Object.values(initial.library.words).every((w) => w.stats.seen === 0)).toBe(true);
    const text = await storage.read('data/words.json');
    await repo.initialize();
    expect(await storage.read('data/words.json')).toBe(text);
    const invalid = structuredClone(initial.library);
    invalid.words.affect.stats.seen = -1;
    await expect(repo.save(initial.library, invalid)).rejects.toThrow();
    expect(await storage.read('data/words.json')).toBe(text);
  });
  it('blocks external revisions and same-revision edits without overwriting', async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    const { library } = await repo.initialize();
    const external = structuredClone(library);
    external.words.affect.notes = 'saved by Codex';
    external.revision++;
    await storage.write('data/words.json', JSON.stringify(external));
    await expect(repo.save(library, library)).rejects.toBeInstanceOf(ConflictError);
    expect((await repo.load()).library.words.affect.notes).toBe('saved by Codex');
    external.revision = library.revision;
    await storage.write('data/words.json', JSON.stringify(external));
    await expect(repo.save(library, library)).rejects.toBeInstanceOf(ConflictError);
  });
  it('recovers an interrupted history write exactly once across reloads', async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    const { library } = await repo.initialize();
    const result = applyReview(library.words.affect, 'wrong', '效果', 3000, DEFAULT_CONFIG);
    const next = structuredClone(library);
    next.words.affect = result.word;
    storage.failOn = `data/reviews/${result.review.time.slice(0, 7)}.jsonl`;
    await expect(repo.save(library, next, [result.review])).rejects.toThrow('disconnected');
    expect(storage.files.has('data/pending.json')).toBe(true);
    storage.failOn = '';
    const recovered = await new Repository(storage).load();
    expect(recovered.library.revision).toBe(1);
    expect(recovered.library.words.affect.stats.wrong).toBe(1);
    expect(recovered.reviews).toHaveLength(1);
    expect((await repo.load()).reviews).toHaveLength(1);
    expect(storage.files.has('data/pending.json')).toBe(false);
  });
  it('recovers an interrupted words write and does not invent history', async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    const { library } = await repo.initialize();
    const next = structuredClone(library);
    next.words.affect.notes = 'test';
    storage.failOn = 'data/words.json';
    await expect(repo.save(library, next)).rejects.toThrow();
    storage.failOn = '';
    expect((await repo.load()).library.words.affect.notes).toBe('test');
  });
  it('restores safely with increasing revision and retains historical events', async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    const { library } = await repo.initialize();
    const backup = await repo.backup();
    const result = applyReview(library.words.affect, 'correct', '影响', 1000, DEFAULT_CONFIG);
    const next = structuredClone(library);
    next.words.affect = result.word;
    const saved = await repo.save(library, next, [result.review]);
    await repo.restore(saved, backup);
    const loaded = await repo.load();
    expect(loaded.library.revision).toBe(2);
    expect(loaded.library.words.affect.stats.seen).toBe(0);
    expect(loaded.reviews).toHaveLength(1);
  });
  it('refuses corrupt history and conflicting unfinished transactions', async () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    const { library } = await repo.initialize();
    await storage.write('data/reviews/2026-09.jsonl', '{broken}\n');
    await expect(repo.load()).rejects.toThrow('损坏');
    await storage.remove('data/reviews/2026-09.jsonl');
    const before = structuredClone(library);
    before.revision = 99;
    await storage.write(
      'data/pending.json',
      JSON.stringify({ schema_version: 1, before, after: before, reviews: [] }),
    );
    await expect(repo.load()).rejects.toThrow('冲突');
    expect(storage.files.has('data/pending.json')).toBe(true);
  });
});

describe('imports and schema', () => {
  it('parses quoted multilingual CSV and protects spreadsheet exports', () => {
    const rows = parseImport(
      '\ufeffword,meaning\r\nmaintain,"保持,维持"\r\ntest,"测试\n检验"\r\n',
      'words.csv',
    );
    expect(rows[0].core_meaning).toBe('保持,维持');
    expect(rows[1].core_meaning).toBe('测试\n检验');
    expect(parseImport(exportCSV(rows), 'roundtrip.csv')[1].core_meaning).toBe('测试\n检验');
    rows[0].core_meaning = '=2+2';
    expect(exportCSV(rows)).toContain("'=2+2");
  });
  it('rejects duplicate words, invalid dates, unknown schemas and inconsistent stats', () => {
    expect(() => parseImport('word,meaning\ntest,测试\ntest,试验', 'x.csv')).toThrow('重复');
    const l = starterLibrary();
    l.words.affect.schedule.due_at = '2026-02-30';
    expect(() => validateLibrary(l)).toThrow();
    l.words.affect.schedule.due_at = '2026-01-99';
    expect(() => validateLibrary(l)).toThrow('校验');
    expect(() => validateLibrary({ ...starterLibrary(), schema_version: 2 })).toThrow();
  });
  it('merges lexical data while preserving scores and unknown extension fields', () => {
    const l = starterLibrary();
    l.words.affect = applyReview(l.words.affect, 'correct', '影响', 1000, DEFAULT_CONFIG).word;
    l.words.affect.custom_field = { keep: true };
    const incoming = newWord('affect', '影响；感动');
    incoming.tags = ['我的标签'];
    const merged = mergeWords(l, [incoming], 'merge');
    expect(merged.words.affect.stats.seen).toBe(1);
    expect(merged.words.affect.tags).toContain('我的标签');
    expect(merged.words.affect.custom_field).toEqual({ keep: true });
    expect(mergeWords(l, [incoming], 'skip').words.affect.core_meaning).toBe('影响');
    expect(mergeWords(l, [incoming], 'overwrite').words.affect.stats.seen).toBe(0);
  });
});
