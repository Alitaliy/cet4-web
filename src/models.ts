import { z } from 'zod';

export const STATUSES = ['new', 'learning', 'fuzzy', 'confusing', 'mastered', 'suspended'] as const;
export const RESULTS = ['correct', 'fuzzy', 'wrong', 'unknown'] as const;
export const STATUS_LABEL: Record<Status, string> = {
  new: '新词',
  learning: '学习中',
  fuzzy: '模糊',
  confusing: '易混淆',
  mastered: '已掌握',
  suspended: '已暂停',
};
export const RESULT_LABEL: Record<Result, string> = {
  correct: '正确',
  fuzzy: '模糊',
  wrong: '错误',
  unknown: '不会',
};
const count = z.number().int().nonnegative();
const timestamp = z
  .string()
  .refine((v) => /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)), '时间格式无效');
const day = z
  .string()
  .refine(
    (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(v + 'T12:00:00Z')) &&
      new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v,
    '日期格式无效',
  );
const resultSchema = z.enum(RESULTS);
const wordSchema = z
  .object({
    word: z
      .string()
      .regex(/^[a-z]+(?:[ '-][a-z]+)*$/, '单词需为小写英文字母，可包含空格、连字符或撇号'),
    phonetic: z.string(),
    core_meaning: z.string().min(1),
    meanings: z.array(
      z.object({ pos: z.string(), zh: z.string(), primary: z.boolean() }).passthrough(),
    ),
    status: z.enum(STATUSES),
    tags: z.array(z.string()),
    confused_with: z.array(z.string()),
    wrong_answers: z.record(z.string(), count),
    synonyms: z.array(z.string()),
    antonyms: z.array(z.string()),
    word_family: z.array(z.string()),
    collocations: z.array(z.string()),
    stats: z
      .object({
        seen: count,
        correct: count,
        wrong: count,
        fuzzy: count,
        streak: count,
        lapses: count,
        avg_response_ms: z.number().nonnegative().nullable(),
        response_count: count.optional(),
      })
      .passthrough(),
    schedule: z.object({ stage: count, interval_days: count, due_at: day }).passthrough(),
    last_review: z
      .object({
        result: resultSchema,
        answer: z.string(),
        response_ms: z.number().nonnegative().nullable(),
        at: timestamp,
      })
      .passthrough()
      .nullable(),
    created_at: timestamp,
    updated_at: timestamp,
    notes: z.string(),
  })
  .passthrough();
export const librarySchema = z
  .object({
    schema_version: z.literal(1),
    revision: count,
    updated_at: timestamp,
    updated_by: z.enum(['web', 'codex', 'manual', 'migration', 'import']),
    words: z.record(z.string(), wordSchema),
  })
  .passthrough()
  .superRefine((lib, ctx) => {
    for (const [key, word] of Object.entries(lib.words)) {
      if (key !== word.word || ['__proto__', 'constructor', 'prototype'].includes(key))
        ctx.addIssue({ code: 'custom', message: `单词索引不匹配：${key}` });
      const { seen, correct, wrong, fuzzy, streak } = word.stats;
      if (seen !== correct + wrong + fuzzy || streak > correct)
        ctx.addIssue({ code: 'custom', message: `统计不一致：${key}` });
      if (word.stats.response_count !== undefined && word.stats.response_count > seen)
        ctx.addIssue({ code: 'custom', message: `计时次数超过测试次数：${key}` });
    }
  });
export const reviewSchema = z
  .object({
    id: z.string().min(1),
    word: z.string().min(1),
    time: timestamp,
    result: resultSchema,
    answer: z.string(),
    response_ms: z.number().nonnegative().nullable().optional(),
    source: z.enum(['web', 'codex', 'import', 'manual']),
    error_type: z.string().optional(),
  })
  .passthrough();
export const configSchema = z
  .object({
    daily_limit: z.number().int().min(5).max(100),
    backup_limit: z.number().int().min(5).max(100),
    slow_response_ms: z.number().int().min(1000).max(30000),
  })
  .passthrough();
export type Library = z.infer<typeof librarySchema>;
export type Word = z.infer<typeof wordSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Config = z.infer<typeof configSchema>;
export type Status = (typeof STATUSES)[number];
export type Result = (typeof RESULTS)[number];
export const DEFAULT_CONFIG: Config = { daily_limit: 30, backup_limit: 30, slow_response_ms: 5000 };
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localDay(d);
}
export function emptyLibrary(): Library {
  return {
    schema_version: 1,
    revision: 0,
    updated_at: new Date().toISOString(),
    updated_by: 'web',
    words: {},
  };
}
export function newWord(word: string, meaning: string, pos = ''): Word {
  const now = new Date().toISOString();
  return {
    word: word.trim().toLowerCase(),
    phonetic: '',
    core_meaning: meaning.trim(),
    meanings: [{ pos, zh: meaning.trim(), primary: true }],
    status: 'new',
    tags: ['CET4'],
    confused_with: [],
    wrong_answers: {},
    synonyms: [],
    antonyms: [],
    word_family: [],
    collocations: [],
    stats: { seen: 0, correct: 0, wrong: 0, fuzzy: 0, streak: 0, lapses: 0, avg_response_ms: null },
    schedule: { stage: 0, interval_days: 0, due_at: localDay() },
    last_review: null,
    created_at: now,
    updated_at: now,
    notes: '',
  };
}
export function validateLibrary(value: unknown): Library {
  const result = librarySchema.safeParse(value);
  if (!result.success)
    throw new Error(
      `词库校验失败：${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('；')}`,
    );
  return result.data;
}
