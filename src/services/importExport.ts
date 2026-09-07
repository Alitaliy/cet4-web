import {
  newWord,
  validateLibrary,
  emptyLibrary,
  STATUS_LABEL,
  type Word,
  type Library,
} from '../models';

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if (c === '\n' && !quoted) {
      row.push(field.replace(/\r$/, ''));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('CSV 引号未闭合。');
  row.push(field.replace(/\r$/, ''));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseImport(text: string, filename: string): Word[] {
  text = text.replace(/^\uFEFF/, '');
  let words: Word[];
  if (filename.toLowerCase().endsWith('.json'))
    return Object.values(validateLibrary(JSON.parse(text)).words);
  if (filename.toLowerCase().endsWith('.csv')) {
    const rows = parseCSV(text);
    const header = rows.shift()?.map((s) => s.trim().toLowerCase()) || [];
    const wi = header.indexOf('word');
    const mi = header.findIndex((h) => ['meaning', 'core_meaning', 'zh'].includes(h));
    if (wi < 0 || mi < 0) throw new Error('CSV 表头需包含 word 和 meaning（或 core_meaning）。');
    words = rows.map((row, i) => {
      if (!row[wi]?.trim() || !row[mi]?.trim())
        throw new Error(`CSV 第 ${i + 2} 行缺少单词或词义。`);
      return newWord(row[wi], row[mi]);
    });
  } else {
    words = text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((line, i) => {
        const m = line.trim().match(/^([a-zA-Z]+(?:['-][a-zA-Z]+)*)\s+(.+)$/);
        if (!m) throw new Error(`TXT 第 ${i + 1} 行需为“word 中文释义”。`);
        return newWord(m[1], m[2]);
      });
  }
  if (!words.length) throw new Error('文件内没有可导入的单词。');
  const keys = new Set<string>();
  for (const w of words) {
    if (keys.has(w.word)) throw new Error(`文件内有重复单词：${w.word}，请先合并。`);
    keys.add(w.word);
  }
  validateLibrary({ ...emptyLibrary(), words: Object.fromEntries(words.map((w) => [w.word, w])) });
  return words;
}
export function mergeWords(
  current: Library,
  incoming: Word[],
  mode: 'skip' | 'merge' | 'overwrite',
): Library {
  const next = structuredClone(current);
  for (const w of incoming) {
    const old = next.words[w.word];
    if (!old || mode === 'overwrite') next.words[w.word] = structuredClone(w);
    else if (mode === 'merge')
      next.words[w.word] = {
        ...old,
        core_meaning: w.core_meaning,
        meanings: w.meanings,
        tags: [...new Set([...old.tags, ...w.tags])],
        confused_with: [...new Set([...old.confused_with, ...w.confused_with])],
        synonyms: [...new Set([...old.synonyms, ...w.synonyms])],
        collocations: [...new Set([...old.collocations, ...w.collocations])],
        notes: [...new Set([old.notes, w.notes].filter(Boolean))].join('\n'),
        updated_at: new Date().toISOString(),
      };
  }
  return validateLibrary(next);
}
const csvCell = (s: string) =>
  '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"';
export function exportCSV(words: Word[]) {
  return (
    '\uFEFFword,meaning,status,tags,correct,wrong,due_at\r\n' +
    words
      .map((w) =>
        [
          w.word,
          w.core_meaning,
          STATUS_LABEL[w.status],
          w.tags.join(';'),
          String(w.stats.correct),
          String(w.stats.wrong),
          w.schedule.due_at,
        ]
          .map(csvCell)
          .join(','),
      )
      .join('\r\n')
  );
}
export function exportMarkdown(words: Word[]) {
  return (
    '# CET-4 词汇笔记\n\n' +
    words
      .map(
        (w) =>
          `## ${w.word}\n\n${w.core_meaning}\n\n状态：${STATUS_LABEL[w.status]}\n\n易混词：${w.confused_with.join('、') || '无'}\n\n历史错误：${
            Object.entries(w.wrong_answers)
              .map(([a, n]) => `${a} × ${n}`)
              .join('；') || '无'
          }\n\n${w.notes}\n`,
      )
      .join('\n')
  );
}
export function download(content: string | Blob, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
