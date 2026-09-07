"""Local JSON repository with backups, optimistic concurrency and recoverable commits."""
import json
import os
from pathlib import Path
from contextlib import contextmanager
from uuid import uuid4
from copy import deepcopy
from scheduler import now, new_word
from validator import validate, validate_review, validate_config, DEFAULT_CONFIG, ensure


class ConflictError(RuntimeError):
    pass


class Repository:
    def __init__(self, home=None):
        self.home = Path(home or os.environ.get('CET4_VOCAB_HOME') or Path.home() / 'Documents' / 'CET4-Vocab').expanduser().resolve()

    def read_text(self, relative):
        path = self.home / relative
        return path.read_text(encoding='utf-8-sig') if path.exists() else None

    def atomic_text(self, relative, text):
        path = self.home / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + '.' + uuid4().hex + '.tmp')
        try:
            with temporary.open('x', encoding='utf-8', newline='\n') as f:
                f.write(text)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temporary, path)
        finally:
            if temporary.exists():
                temporary.unlink()

    def write_json(self, relative, value):
        self.atomic_text(relative, json.dumps(value, ensure_ascii=False, indent=2) + '\n')

    def current(self):
        text = self.read_text('data/words.json')
        return validate(json.loads(text)) if text is not None else None

    @contextmanager
    def lock(self):
        # Serializes Python processes. Browser tabs use Web Locks; cross-client
        # changes are checked by comparing full expected state before committing.
        self.home.mkdir(parents=True, exist_ok=True)
        lock = self.home / '.codex-write.lock'
        try:
            with lock.open('x', encoding='utf-8') as file:
                json.dump({'pid': os.getpid(), 'created_at': now()}, file)
        except FileExistsError:
            raise RuntimeError(f'Another CLI operation is active. If its process has stopped, remove the stale lock: {lock}') from None
        try:
            yield
        finally:
            lock.unlink(missing_ok=True)

    def append_reviews(self, rows):
        for month in sorted({r['time'][:7] for r in rows}):
            relative = f'data/reviews/{month}.jsonl'
            text = self.read_text(relative) or ''
            existing = [validate_review(json.loads(line)) for line in text.splitlines() if line.strip()]
            ids = {r['id'] for r in existing}
            fresh = [r for r in rows if r['time'].startswith(month) and r['id'] not in ids]
            if fresh:
                self.atomic_text(relative, text + ('\n' if text and not text.endswith('\n') else '') + ''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in fresh))

    def recover(self):
        raw = self.read_text('data/pending.json')
        if not raw:
            return
        journal = json.loads(raw)
        ensure(journal.get('schema_version') == 1 and isinstance(journal.get('reviews'), list), 'Invalid pending journal; preserve it and inspect manually')
        if journal['before'] is not None:
            validate(journal['before'])
        validate(journal['after'])
        for r in journal['reviews']:
            validate_review(r)
        disk = self.current()
        if disk == journal['before']:
            self.write_json('data/words.json', journal['after'])
        elif disk != journal['after']:
            raise ConflictError('Pending transaction conflicts with disk. Preserve pending.json and reconcile with a backup.')
        self.append_reviews(journal['reviews'])
        (self.home / 'data/pending.json').unlink()

    def initialize(self):
        with self.lock():
            self.recover()
            if self.current() is not None:
                return self.current()
            for folder in ['data/reviews', 'backups', 'exports', 'logs']:
                (self.home / folder).mkdir(parents=True, exist_ok=True)
            if self.read_text('data/config.json') is None:
                self.write_json('data/config.json', DEFAULT_CONFIG)
            self.write_json('data/meta.json', {'schema_version': 1, 'created_at': now(), 'app': 'cet4-vocab'})
            words = {}
            for seed in json.loads((Path(__file__).parent.parent / 'assets/seed_words.json').read_text(encoding='utf-8')):
                w = new_word(seed['word'], seed['meaning'], seed.get('pos', ''))
                w.update({k: v for k, v in seed.items() if k not in {'meaning', 'pos'}})
                words[w['word']] = w
            library = validate({'schema_version': 1, 'revision': 0, 'updated_at': now(), 'updated_by': 'codex', 'words': words})
            self.write_json('data/pending.json', {'schema_version': 1, 'before': None, 'after': library, 'reviews': []})
            self.recover()
            return library

    def load(self):
        with self.lock():
            self.recover()
            library = self.current()
            ensure(library is not None, 'No words.json found. Run init first.')
            return library

    def config(self):
        text = self.read_text('data/config.json')
        return validate_config(json.loads(text)) if text else deepcopy(DEFAULT_CONFIG)

    def reviews(self):
        rows = []
        for path in sorted((self.home / 'data/reviews').glob('????-??.jsonl')):
            for i, line in enumerate(path.read_text(encoding='utf-8-sig').splitlines()):
                if line.strip():
                    try:
                        rows.append(validate_review(json.loads(line)))
                    except (ValueError, TypeError) as error:
                        raise ValueError(f'{path.name} line {i + 1}: {error}') from error
        return rows

    def backup(self, library=None):
        library = library or self.current()
        ensure(library is not None, 'No library to back up')
        name = 'words_' + now().replace(':', '-').replace('.', '-') + '_' + uuid4().hex[:8] + '.json'
        self.write_json('backups/' + name, library)
        return self.home / 'backups' / name

    def save(self, expected, next_library, reviews=None, source='codex'):
        reviews = reviews or []
        with self.lock():
            self.recover()
            if self.current() != expected:
                raise ConflictError('Revision/content conflict. Reload the library, then reapply only the intended changes.')
            after = deepcopy(next_library)
            after.update(revision=expected['revision'] + 1, updated_at=now(), updated_by=source)
            validate(after)
            for row in reviews:
                validate_review(row)
            self.backup(expected)
            if self.current() != expected:
                raise ConflictError('The library changed while preparing the backup; reload and retry.')
            self.write_json('data/pending.json', {'schema_version': 1, 'before': expected, 'after': after, 'reviews': reviews})
            self.recover()
            try:
                backups = sorted((self.home / 'backups').glob('words_*.json'), reverse=True)
                for path in backups[self.config()['backup_limit']:]:
                    path.unlink()
            except (OSError, ValueError):
                pass
            return after

    def restore(self, name):
        expected = self.load()
        path = Path(name).resolve()
        if not path.exists():
            path = self.home / 'backups' / name
        after = validate(json.loads(path.read_text(encoding='utf-8-sig')))
        return self.save(expected, after)
