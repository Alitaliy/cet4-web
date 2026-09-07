import { it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Repository, type Storage } from '../src/services/repository';
import { applyReview } from '../src/algorithms';
import { DEFAULT_CONFIG, newWord } from '../src/models';

class DiskStorage implements Storage {
  constructor(public root: string) {}
  async read(path: string) {
    try {
      return await readFile(join(this.root, path), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }
  async write(path: string, content: string) {
    const file = join(this.root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
  }
  async list(path: string) {
    try {
      return await readdir(join(this.root, path));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }
  async remove(path: string) {
    await unlink(join(this.root, path));
  }
}
const cli = resolve('skills/cet4-vocab-coach/scripts/vocab.py');
it('shares actual files between Python and the browser repository, including journal recovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cet4-interop-'));
  const py = (...args: string[]) =>
    JSON.parse(
      execFileSync('python', [cli, '--home', root, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PYTHONUTF8: '1' },
      }),
    );
  expect(py('init').words).toBe(48);
  const repo = new Repository(new DiskStorage(root));
  const initial = await repo.load();
  const result = applyReview(initial.library.words.affect, 'wrong', '效果', 2400, DEFAULT_CONFIG);
  const next = structuredClone(initial.library);
  next.words.affect = result.word;
  await repo.save(initial.library, next, [result.review]);
  expect(py('show', 'affect').stats.wrong).toBe(1);
  const input = join(root, 'results.json');
  await writeFile(
    input,
    JSON.stringify({
      batch_id: 'interop',
      expected_revision: 1,
      results: [{ word: 'reveal', result: 'correct', answer: '揭示' }],
    }),
  );
  expect(py('record-batch', input).recorded).toBe(1);
  const loaded = await repo.load();
  expect(loaded.library.revision).toBe(2);
  expect(loaded.reviews).toHaveLength(2);
  expect(loaded.library.words.reveal.stats.correct).toBe(1);
  const after = structuredClone(loaded.library);
  after.revision++;
  after.updated_by = 'web';
  after.words.reveal.notes = 'recovered across clients';
  await repo.storage.write(
    'data/pending.json',
    JSON.stringify({ schema_version: 1, before: loaded.library, after, reviews: [] }),
  );
  expect(py('show', 'reveal').notes).toBe('recovered across clients');
  expect(await repo.storage.read('data/pending.json')).toBeNull();
});
it('JavaScript and Python schedule the same sequence identically', () => {
  const word = newWord('example', '例子');
  const steps: [string, string, number | null][] = [
    ['correct', '例子', 1200],
    ['fuzzy', '例子？', null],
    ['wrong', '实例之外', 3000],
    ...Array.from(
      { length: 7 },
      () => ['correct', '例子', 1500] as [string, string, number | null],
    ),
    ['correct', '例子', 9000],
    ['unknown', '', null],
  ];
  const time = new Date().toISOString();
  let js = word;
  for (const [result, answer, ms] of steps)
    js = applyReview(js, result as 'correct', answer, ms, DEFAULT_CONFIG, time).word;
  const source =
    "import json,sys;sys.path.insert(0,sys.argv[1]);from scheduler import apply_review;p=json.load(sys.stdin);w=p['word'];\nfor r,a,ms in p['steps']: w,_=apply_review(w,r,a,ms,time=p['time'])\nprint(json.dumps(w,ensure_ascii=False))";
  const py = JSON.parse(
    execFileSync('python', ['-c', source, resolve('skills/cet4-vocab-coach/scripts')], {
      input: JSON.stringify({ word, steps, time }),
      encoding: 'utf8',
      env: { ...process.env, PYTHONUTF8: '1' },
    }),
  );
  expect(py).toEqual(js);
});
