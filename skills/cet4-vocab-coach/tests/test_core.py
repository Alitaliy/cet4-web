import json
import sys
import tempfile
import unittest
from pathlib import Path
from copy import deepcopy
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from repository import Repository, ConflictError
from scheduler import apply_review, new_word, queue
from validator import validate
from vocab import add_batch, record_batch


class RepositoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Repository(self.temp.name)
        self.initial = self.repo.initialize()

    def test_init_is_idempotent_and_clean(self):
        self.assertEqual(len(self.initial['words']), 48)
        self.assertTrue(all(w['stats']['seen'] == 0 for w in self.initial['words'].values()))
        self.assertEqual(self.repo.initialize(), self.initial)
        self.assertEqual(self.repo.reviews(), [])

    def test_external_change_and_revision_conflict(self):
        external = deepcopy(self.initial)
        external['words']['affect']['notes'] = 'web edit without revision bump'
        self.repo.write_json('data/words.json', external)
        with self.assertRaises(ConflictError):
            self.repo.save(self.initial, self.initial)
        self.assertEqual(self.repo.load(), external)

    def test_invalid_schema_does_not_overwrite(self):
        invalid = deepcopy(self.initial)
        invalid['words']['affect']['stats']['seen'] = -1
        with self.assertRaises(ValueError):
            self.repo.save(self.initial, invalid)
        self.assertEqual(self.repo.load(), self.initial)

    def test_batch_idempotency_and_confusions(self):
        batch = {'batch_id': 'test-batch', 'expected_revision': 0, 'results': [{'word': 'affect', 'result': 'wrong', 'answer': '效果', 'confused_with': ['effect']}, {'word': 'reveal', 'result': 'correct', 'answer': '揭示'}]}
        self.assertEqual(record_batch(self.repo, batch)['recorded'], 2)
        self.assertEqual(record_batch(self.repo, batch)['recorded'], 0)
        updated = self.repo.load()
        self.assertEqual(updated['revision'], 1)
        self.assertEqual(updated['words']['affect']['stats']['wrong'], 1)
        self.assertIn('affect', updated['words']['effect']['confused_with'])
        self.assertEqual(len(self.repo.reviews()), 2)
        batch['results'][0]['answer'] = 'different answer'
        with self.assertRaises(ValueError):
            record_batch(self.repo, batch)

    def test_add_words_preserves_progress_and_creates_untested_words(self):
        record_batch(self.repo, [{'word': 'affect', 'result': 'correct', 'answer': '影响'}])
        before = self.repo.load()
        history = self.repo.reviews()
        batch = {'expected_revision': before['revision'], 'words': [
            {'word': 'AFFECT', 'core_meaning': '不得覆盖'},
            {'word': ' abundant ', 'core_meaning': '丰富的', 'pos': 'adj.', 'tags': ['AI选词', 'AI选词'], 'collocations': ['abundant resources'], 'notes': '原创例句'},
            {'word': 'ABUNDANT', 'core_meaning': '丰富的'},
            {'word': 'allocate', 'core_meaning': '分配', 'pos': 'v.'},
        ]}
        result = add_batch(self.repo, batch)
        self.assertEqual(result['added'], 2)
        self.assertEqual(result['skipped_existing'], ['affect'])
        self.assertEqual(result['skipped_duplicates'], ['abundant'])
        self.assertEqual(result['total'], 50)
        self.assertEqual(result['revision'], before['revision'] + 1)
        after = self.repo.load()
        for key, word in before['words'].items():
            self.assertEqual(after['words'][key], word)
        self.assertEqual(self.repo.reviews(), history)
        word = after['words']['abundant']
        self.assertEqual(word['status'], 'new')
        self.assertEqual(word['stats']['seen'], 0)
        self.assertIsNone(word['last_review'])
        self.assertEqual(word['tags'], ['CET4', 'AI选词'])
        self.assertEqual(word['schedule']['due_at'], date.today().isoformat())
        self.assertEqual(word['meanings'][0]['pos'], 'adj.')
        self.assertEqual(word['collocations'], ['abundant resources'])

    def test_add_words_retry_has_no_write_or_extra_backup(self):
        batch = {'expected_revision': 0, 'words': [{'word': 'abundant', 'core_meaning': '丰富的'}]}
        add_batch(self.repo, batch)
        before = self.repo.load()
        files_before = {str(p.relative_to(self.repo.home)): p.read_bytes() for p in self.repo.home.rglob('*') if p.is_file()}
        retry = add_batch(self.repo, batch)
        self.assertEqual(retry['added'], 0)
        self.assertEqual(retry['revision'], before['revision'])
        files_after = {str(p.relative_to(self.repo.home)): p.read_bytes() for p in self.repo.home.rglob('*') if p.is_file()}
        self.assertEqual(files_after, files_before)

    def test_invalid_word_batch_does_not_partially_save(self):
        for invalid in [
            {'word': 'allocate', 'core_meaning': ' '},
            {'word': 'bad123', 'core_meaning': '无效'},
            {'word': 'allocate', 'core_meaning': '分配', 'status': 'mastered'},
            {'word': 'allocate', 'core_meaning': '分配', 'collocations': [12]},
        ]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                add_batch(self.repo, {'expected_revision': 0, 'words': [{'word': 'abundant', 'core_meaning': '丰富的'}, invalid]})
            self.assertEqual(self.repo.load(), self.initial)
            self.assertEqual(self.repo.reviews(), [])
            self.assertFalse((self.repo.home / 'data/pending.json').exists())

    def test_add_words_rejects_stale_or_missing_revision(self):
        row = {'word': 'abundant', 'core_meaning': '丰富的'}
        for revision in [None, -1, True]:
            with self.subTest(revision=revision), self.assertRaises(ValueError):
                add_batch(self.repo, {'expected_revision': revision, 'words': [row]})
        record_batch(self.repo, [{'word': 'affect', 'result': 'correct', 'answer': '影响'}])
        before = self.repo.load()
        with self.assertRaises(ConflictError):
            add_batch(self.repo, {'expected_revision': 0, 'words': [row]})
        self.assertEqual(self.repo.load(), before)

    def test_interrupted_commit_recovers_once(self):
        w, r = apply_review(self.initial['words']['affect'], 'wrong', '效果', 3000)
        after = deepcopy(self.initial)
        after['words']['affect'] = w
        append = self.repo.append_reviews
        self.repo.append_reviews = lambda _: (_ for _ in ()).throw(OSError('disk disconnected'))
        with self.assertRaises(OSError):
            self.repo.save(self.initial, after, [r])
        self.assertTrue((self.repo.home / 'data/pending.json').exists())
        self.repo.append_reviews = append
        loaded = self.repo.load()
        self.assertEqual(loaded['revision'], 1)
        self.assertEqual(loaded['words']['affect']['stats']['wrong'], 1)
        self.repo.load()
        self.assertEqual(len(self.repo.reviews()), 1)
        self.assertFalse((self.repo.home / 'data/pending.json').exists())

    def test_web_journal_can_be_recovered_by_cli(self):
        after = deepcopy(self.initial)
        after['updated_by'] = 'web'
        after['revision'] = 1
        after['words']['affect']['notes'] = 'written by web'
        self.repo.write_json('data/pending.json', {'schema_version': 1, 'before': self.initial, 'after': after, 'reviews': []})
        self.assertEqual(self.repo.load(), after)

    def test_restore_preserves_logs_and_advances_revision(self):
        backup = self.repo.backup()
        record_batch(self.repo, [{'word': 'affect', 'result': 'correct', 'answer': '影响'}])
        restored = self.repo.restore(str(backup))
        self.assertEqual(restored['revision'], 2)
        self.assertEqual(restored['words']['affect']['stats']['seen'], 0)
        self.assertEqual(len(self.repo.reviews()), 1)

    def test_corruption_is_not_reinitialized(self):
        self.repo.atomic_text('data/words.json', '{broken')
        with self.assertRaises(ValueError):
            self.repo.initialize()
        self.assertEqual(self.repo.read_text('data/words.json'), '{broken')


class SchedulerTests(unittest.TestCase):
    def test_intervals_slow_retrieval_and_lapse(self):
        w = new_word('maintain', '保持')
        for interval in [1, 2, 4, 7, 15, 30, 60]:
            w, _ = apply_review(w, 'correct', '保持', 1000)
            self.assertEqual(w['schedule']['interval_days'], interval)
        self.assertEqual(w['status'], 'mastered')
        w, _ = apply_review(w, 'correct', '保持', 9000)
        self.assertEqual(w['status'], 'learning')
        self.assertEqual(w['schedule']['interval_days'], 4)
        w, _ = apply_review(w, 'unknown')
        self.assertEqual(w['stats']['streak'], 0)
        self.assertEqual(w['stats']['lapses'], 1)
        self.assertEqual(w['schedule']['due_at'], (date.today() + timedelta(days=1)).isoformat())

    def test_mixed_timed_and_untimed_reviews(self):
        w = new_word('test', '测试')
        w, _ = apply_review(w, 'correct', '测试', 1000)
        for _ in range(4):
            w, _ = apply_review(w, 'correct', '测试', None)
        w, _ = apply_review(w, 'fuzzy', '测试', 3000)
        self.assertEqual(w['stats']['avg_response_ms'], 2000)
        self.assertEqual(w['stats']['response_count'], 2)

    def test_queue_has_no_duplicates_or_suspended_words(self):
        words = [new_word('word' + chr(97 + i), '词') for i in range(20)]
        for w in words[:8]:
            w['status'] = 'confusing'
        words[-1]['status'] = 'suspended'
        selected = queue(words, 30)
        self.assertEqual(len(selected), len({w['word'] for w in selected}))
        self.assertEqual(len(selected), 19)


if __name__ == '__main__':
    unittest.main()
