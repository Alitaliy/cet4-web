#!/usr/bin/env python3
"""CET-4 coach CLI. Python 3.10+, no third-party dependencies."""
import argparse
import csv
import io
import json
import sys
from pathlib import Path
from copy import deepcopy
from datetime import date, datetime, timedelta
from repository import Repository, ConflictError
from scheduler import new_word, apply_review, queue, now
from validator import validate, ensure, RESULTS


def emit(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def check_revision(library, expected):
    if expected is not None and library['revision'] != expected:
        raise ConflictError(f"Expected revision {expected}, found {library['revision']}. Reload and reconcile before retrying.")


def record_batch(repo, payload, expected_revision=None):
    library = repo.load()
    rows = payload if isinstance(payload, list) else payload.get('results')
    batch_id = payload.get('batch_id') if isinstance(payload, dict) else None
    expected_revision = expected_revision if expected_revision is not None else payload.get('expected_revision') if isinstance(payload, dict) else None
    ensure(isinstance(rows, list) and rows, 'results must be a non-empty array')
    ensure(batch_id is None or (isinstance(batch_id, str) and batch_id), 'batch_id must be a non-empty string')
    existing = {r['id']: r for r in repo.reviews()}
    pending = []
    for index, row in enumerate(rows):
        ensure(isinstance(row, dict) and row.get('result') in RESULTS, f'Invalid result at row {index + 1}')
        rid = row.get('id') or (f'{batch_id}:{index}' if batch_id else None)
        if rid and rid in existing:
            old = existing[rid]
            ensure(old['word'] == row.get('word') and old['result'] == row['result'] and old['answer'] == row.get('answer', ''), f'Id reused for different result: {rid}')
        else:
            pending.append((row, rid))
    if not pending:
        return {'recorded': 0, 'already_recorded': len(rows), 'revision': library['revision']}
    check_revision(library, expected_revision)
    next_library = deepcopy(library)
    reviews = []
    for row, rid in pending:
        key = str(row.get('word', '')).strip().lower()
        ensure(key, 'Missing word')
        if key not in next_library['words']:
            ensure(isinstance(row.get('core_meaning'), str) and row['core_meaning'], f'Unknown word {key}: provide core_meaning')
            next_library['words'][key] = new_word(key, row['core_meaning'])
        w = next_library['words'][key]
        ensure(w['status'] != 'suspended', f'{key} is suspended; resume it before testing')
        peers = row.get('confused_with', [])
        ensure(isinstance(peers, list) and all(isinstance(p, str) for p in peers), 'confused_with must be an array of words')
        w['confused_with'] = sorted(set(w['confused_with'] + [p.lower() for p in peers if p.lower() != key]))
        if 'notes' in row:
            ensure(isinstance(row['notes'], str), 'notes must be text')
            w['notes'] = '\n'.join(dict.fromkeys(filter(None, [w['notes'], row['notes']])))
        updated, review = apply_review(w, row['result'], row.get('answer', ''), row.get('response_ms'), repo.config())
        if rid:
            review['id'] = rid
        if row.get('error_type'):
            review['error_type'] = row['error_type']
        next_library['words'][key] = updated
        for peer in updated['confused_with']:
            if peer in next_library['words']:
                other = next_library['words'][peer]
                other['confused_with'] = sorted(set(other['confused_with'] + [key]))
                other['updated_at'] = review['time']
        reviews.append(review)
    result = repo.save(library, next_library, reviews)
    return {'recorded': len(reviews), 'already_recorded': len(rows) - len(reviews), 'revision': result['revision']}


def safe_cell(value):
    value = str(value)
    return "'" + value if value.startswith(('=', '+', '-', '@', '\t', '\r')) else value


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', help='CET4 data directory (otherwise CET4_VOCAB_HOME or ~/Documents/CET4-Vocab)')
    commands = parser.add_subparsers(dest='command', required=True)
    for cmd in ['init', 'all', 'stats', 'validate', 'backup']:
        commands.add_parser(cmd).add_argument('--json', action='store_true', help='Output is always machine-readable JSON')
    due = commands.add_parser('due')
    due.add_argument('--limit', type=int, default=30)
    due.add_argument('--json', action='store_true')
    show = commands.add_parser('show')
    show.add_argument('word')
    show.add_argument('--json', action='store_true')
    batch = commands.add_parser('record-batch')
    batch.add_argument('file')
    batch.add_argument('--expect-revision', type=int)
    add = commands.add_parser('add')
    add.add_argument('word')
    add.add_argument('--meaning', required=True)
    add.add_argument('--pos', default='')
    add.add_argument('--expect-revision', type=int)
    confuse = commands.add_parser('confuse')
    confuse.add_argument('first')
    confuse.add_argument('second')
    confuse.add_argument('--expect-revision', type=int)
    export = commands.add_parser('export')
    export.add_argument('--format', choices=['json', 'csv', 'md', 'session'], default='json')
    export.add_argument('--output')
    restore = commands.add_parser('restore')
    restore.add_argument('file')
    migrate = commands.add_parser('migrate')
    migrate.add_argument('file', nargs='?', help='Optional legacy list / words map to import; no file validates v1 without rewriting')
    args = parser.parse_args(argv)
    repo = Repository(args.home)
    if args.command == 'init':
        library = repo.initialize()
        emit({'home': str(repo.home), 'revision': library['revision'], 'words': len(library['words'])})
        return 0
    if args.command == 'record-batch':
        emit(record_batch(repo, json.loads(Path(args.file).read_text(encoding='utf-8-sig')), args.expect_revision))
        return 0
    library = repo.load()
    if args.command == 'all':
        emit(library)
    elif args.command == 'due':
        ensure(1 <= args.limit <= 100, 'limit must be 1..100')
        emit({'revision': library['revision'], 'home': str(repo.home), 'words': queue(library['words'].values(), args.limit)})
    elif args.command == 'show':
        ensure(args.word.lower() in library['words'], 'Word not found')
        emit(library['words'][args.word.lower()])
    elif args.command == 'stats':
        rows = repo.reviews()
        words = list(library['words'].values())
        result = {'home': str(repo.home), 'revision': library['revision'], 'total': len(words), 'status': {s: sum(w['status'] == s for w in words) for s in sorted({w['status'] for w in words})}, 'due': sum(w['status'] != 'suspended' and w['schedule']['due_at'] <= date.today().isoformat() for w in words)}
        for days in [1, 7, 30]:
            recent = [r for r in rows if datetime.fromisoformat(r['time'].replace('Z', '+00:00')).astimezone().date() >= date.today() - timedelta(days=days-1)]
            result[f'last_{days}_days'] = {'reviews': len(recent), 'accuracy': round(sum(r['result'] == 'correct' for r in recent) / len(recent) * 100, 1) if recent else None}
        emit(result)
    elif args.command == 'validate':
        validate(library)
        config = repo.config()
        rows = repo.reviews()
        emit({'valid': True, 'revision': library['revision'], 'words': len(library['words']), 'reviews': len(rows), 'config': config})
    elif args.command == 'backup':
        with repo.lock():
            emit({'backup': str(repo.backup())})
    elif args.command == 'restore':
        emit({'revision': repo.restore(args.file)['revision'], 'restored': args.file})
    elif args.command in ['add', 'confuse']:
        check_revision(library, args.expect_revision)
        next_library = deepcopy(library)
        if args.command == 'add':
            key = args.word.strip().lower()
            ensure(key not in library['words'], 'Word already exists; edit it in the web UI')
            next_library['words'][key] = new_word(key, args.meaning, args.pos)
        else:
            a, b = args.first.lower(), args.second.lower()
            ensure(a != b and a in library['words'] and b in library['words'], 'Both different words must exist')
            for key, peer in [(a, b), (b, a)]:
                next_library['words'][key]['confused_with'] = sorted(set(next_library['words'][key]['confused_with'] + [peer]))
                next_library['words'][key]['updated_at'] = now()
        emit({'revision': repo.save(library, next_library)['revision']})
    elif args.command == 'export':
        suffix = 'json' if args.format == 'session' else args.format
        path = Path(args.output).resolve() if args.output else repo.home / 'exports' / f"{'cet4-session' if args.format == 'session' else 'words'}.{suffix}"
        ensure(path.resolve() != (repo.home / 'data/words.json').resolve(), 'Export cannot overwrite the master file')
        if args.format == 'json':
            content = json.dumps(library, ensure_ascii=False, indent=2)
        elif args.format == 'session':
            content = json.dumps({'format': 'cet4-session-v1', 'exported_at': now(), 'library': library, 'reviews': repo.reviews(), 'config': repo.config()}, ensure_ascii=False, indent=2)
        elif args.format == 'csv':
            stream = io.StringIO(newline='')
            writer = csv.writer(stream)
            writer.writerow(['word', 'meaning', 'status', 'correct', 'wrong', 'due_at'])
            for w in library['words'].values():
                writer.writerow([safe_cell(v) for v in [w['word'], w['core_meaning'], w['status'], w['stats']['correct'], w['stats']['wrong'], w['schedule']['due_at']]])
            content = '\ufeff' + stream.getvalue()
        else:
            content = '# CET-4 词汇笔记\n\n' + '\n'.join(f"## {w['word']}\n\n{w['core_meaning']}\n\n易混词：{', '.join(w['confused_with']) or '无'}\n\n历史错误：{json.dumps(w['wrong_answers'], ensure_ascii=False)}\n\n{w['notes']}\n" for w in library['words'].values())
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        emit({'exported': str(path)})
    elif args.command == 'migrate':
        if not args.file:
            emit({'schema_version': 1, 'revision': library['revision'], 'changed': False})
        else:
            raw = Path(args.file).read_text(encoding='utf-8-sig')
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and 'schema_version' in parsed:
                migrated = validate(parsed)
            else:
                records = parsed.get('words', parsed) if isinstance(parsed, dict) else parsed
                if isinstance(records, dict):
                    records = [dict(value, word=key) if isinstance(value, dict) else {'word': key, 'meaning': value} for key, value in records.items()]
                ensure(isinstance(records, list), 'Legacy format must be an array or words map')
                migrated = deepcopy(library)
                for row in records:
                    ensure(isinstance(row, dict) and isinstance(row.get('word'), str), 'Legacy row needs word')
                    meaning = row.get('core_meaning', row.get('meaning'))
                    ensure(isinstance(meaning, str) and meaning, f"Missing core meaning: {row.get('word')}")
                    w = new_word(row['word'], meaning)
                    w.update({k: v for k, v in row.items() if k not in {'meaning', 'word'}})
                    key = w['word']
                    ensure(key not in library['words'], f'Legacy word {key} already exists. Use web import preview to choose merge/overwrite.')
                    migrated['words'][key] = w
                validate(migrated)
            backup_name = 'backups/legacy_' + now().replace(':', '-').replace('.', '-') + '.json'
            repo.atomic_text(backup_name, raw)
            emit({'revision': repo.save(library, migrated, source='migration')['revision'], 'source_backup': str(repo.home / backup_name)})
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, KeyError, TypeError) as error:
        print(json.dumps({'error': str(error), 'saved': False}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
