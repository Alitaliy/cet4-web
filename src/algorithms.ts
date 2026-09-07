import { addDays, localDay, type Word, type Result, type Review, type Config } from './models';

export function priority(w: Word): number {
  return (
    (w.schedule.due_at <= localDay() ? 100 : 0) +
    (w.status === 'confusing' ? 45 : 0) +
    (w.status === 'fuzzy' ? 25 : 0) +
    Math.min(w.stats.wrong, 15) * 5 +
    (w.last_review?.result === 'wrong' || w.last_review?.result === 'unknown' ? 20 : 0) +
    Math.min((w.stats.avg_response_ms || 0) / 1000, 20) -
    w.stats.streak * 2
  );
}
export function buildQueue(
  words: Word[],
  limit: number,
  mode: 'daily' | 'mistakes' | 'confusions' = 'daily',
): Word[] {
  const active = words
    .filter((w) => w.status !== 'suspended')
    .sort((a, b) => priority(b) - priority(a) || a.word.localeCompare(b.word));
  if (mode === 'mistakes')
    return active.filter((w) => w.stats.wrong > 0 || w.status === 'fuzzy').slice(0, limit);
  if (mode === 'confusions')
    return active.filter((w) => w.confused_with.length > 0).slice(0, limit);
  const due = active.filter((w) => w.status !== 'new' && w.schedule.due_at <= localDay());
  const difficult = active.filter(
    (w) => w.status === 'confusing' || w.status === 'fuzzy' || w.stats.wrong > 1,
  );
  const fresh = active.filter((w) => w.status === 'new');
  const selected: Word[] = [];
  const take = (pool: Word[], n: number) => {
    let taken = 0;
    for (const w of pool) {
      if (taken >= n) break;
      if (!selected.some((s) => s.word === w.word)) {
        selected.push(w);
        taken++;
      }
    }
  };
  take(due, Math.floor(limit * 0.6));
  take(difficult, Math.floor(limit * 0.2));
  take(fresh, Math.max(1, Math.ceil(limit * 0.2)));
  take([...due, ...difficult, ...fresh], limit - selected.length);
  return selected.slice(0, limit);
}
export function applyReview(
  word: Word,
  result: Result,
  answer: string,
  responseMs: number | null,
  config: Config,
  time = new Date().toISOString(),
  source: Review['source'] = 'web',
): { word: Word; review: Review } {
  const w = structuredClone(word);
  const s = w.stats;
  const measured =
    typeof s.response_count === 'number'
      ? s.response_count
      : s.avg_response_ms === null
        ? 0
        : s.seen;
  s.seen++;
  if (result === 'correct') {
    s.correct++;
    s.streak++;
  } else {
    s.streak = 0;
    if (result === 'fuzzy') s.fuzzy++;
    else {
      s.wrong++;
      s.lapses++;
      if (answer.trim())
        w.wrong_answers = {
          ...w.wrong_answers,
          [answer.trim()]:
            (Object.hasOwn(w.wrong_answers, answer.trim()) ? w.wrong_answers[answer.trim()] : 0) +
            1,
        };
    }
  }
  if (responseMs !== null) {
    s.avg_response_ms = Math.round(
      ((s.avg_response_ms || 0) * measured + responseMs) / (measured + 1),
    );
    s.response_count = measured + 1;
  } else s.response_count = measured;
  let interval = result === 'correct' ? [1, 2, 4, 7, 15, 30, 60][Math.min(s.streak, 7) - 1] : 1;
  const slow = responseMs !== null && responseMs > config.slow_response_ms;
  if (slow && result === 'correct') interval = Math.min(interval, 4);
  w.status =
    result === 'fuzzy'
      ? 'fuzzy'
      : result === 'correct'
        ? s.streak >= 6 && !slow
          ? 'mastered'
          : 'learning'
        : w.confused_with.length
          ? 'confusing'
          : 'learning';
  w.schedule = {
    ...w.schedule,
    stage: result === 'correct' ? Math.min(s.streak, 7) : Math.max(0, w.schedule.stage - 1),
    interval_days: interval,
    due_at: addDays(localDay(new Date(time)), interval),
  };
  w.last_review = { result, answer, response_ms: responseMs, at: time };
  w.updated_at = time;
  const review: Review = {
    id: crypto.randomUUID(),
    word: w.word,
    time,
    result,
    answer,
    response_ms: responseMs,
    source,
  };
  if (result === 'unknown') review.error_type = 'unknown_meaning';
  else if (result === 'fuzzy') review.error_type = 'fuzzy_recall';
  else if (slow && result === 'correct') review.error_type = 'slow_retrieval';
  return { word: w, review };
}
export function meaningMatches(answer: string, word: Word): boolean {
  const normalize = (s: string) => s.trim().replace(/[\s。！？?!]/g, '');
  const a = normalize(answer);
  if (!a) return false;
  return [word.core_meaning, ...word.meanings.map((m) => m.zh)].some((m) =>
    m.split(/[；;、,，/]/).some((v) => normalize(v) === a),
  );
}
export function accuracy(reviews: Review[]): number {
  return reviews.length
    ? Math.round((reviews.filter((r) => r.result === 'correct').length / reviews.length) * 100)
    : 0;
}
export function streakDays(reviews: Review[]): number {
  const days = new Set(reviews.map((r) => localDay(new Date(r.time))));
  let day = localDay();
  let count = 0;
  if (!days.has(day)) day = addDays(day, -1);
  while (days.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
