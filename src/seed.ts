import seed from '../skills/cet4-vocab-coach/assets/seed_words.json';
import {
  emptyLibrary,
  newWord,
  addDays,
  localDay,
  DEFAULT_CONFIG,
  type Review,
  type Result,
} from './models';
import { applyReview } from './algorithms';

export function starterLibrary() {
  const lib = emptyLibrary();
  for (const item of seed) {
    const w = newWord(item.word, item.meaning, item.pos);
    Object.assign(w, {
      phonetic: item.phonetic || '',
      confused_with: item.confused_with || [],
      synonyms: item.synonyms || [],
      collocations: item.collocations || [],
      example: item.example || '',
      translation: item.translation || '',
    });
    lib.words[w.word] = w;
  }
  return lib;
}
/** Synthetic history is ONLY used for the clearly labelled, in-memory demo. */
export function demoData() {
  const lib = starterLibrary();
  const reviews: Review[] = [];
  const keys = Object.keys(lib.words);
  for (let d = 27; d >= 0; d--) {
    if (d === 16 || d === 8) continue;
    for (let n = 0; n < (d === 0 ? 8 : 8 + ((d * 7) % 19)); n++) {
      const key = keys[(d * 5 + n * 3) % 38];
      const w = lib.words[key];
      const result: Result =
        (n + d) % 9 === 0 ? 'fuzzy' : (n * 3 + d) % 7 < 2 ? 'wrong' : 'correct';
      const time = new Date(
        addDays(localDay(), -d) + `T${String(8 + (n % 12)).padStart(2, '0')}:00:00`,
      ).toISOString();
      const answer =
        result === 'wrong'
          ? lib.words[w.confused_with[0]]?.core_meaning.split('；')[0] || '不知道'
          : w.core_meaning.split('；')[0];
      const updated = applyReview(
        w,
        result,
        answer,
        1200 + ((n * 971 + d * 333) % 5200),
        DEFAULT_CONFIG,
        time,
      );
      lib.words[key] = updated.word;
      reviews.push(updated.review);
    }
  }
  for (const [i, key] of keys.entries()) {
    const w = lib.words[key];
    if (i < 12) {
      w.status = 'confusing';
      w.schedule.due_at = localDay();
    } else if (i < 17) {
      w.status = 'fuzzy';
      w.schedule.due_at = localDay();
    } else if (i >= 26 && i < 35) {
      w.status = 'mastered';
      w.schedule.due_at = addDays(localDay(), 15);
    }
  }
  return { library: lib, reviews };
}
