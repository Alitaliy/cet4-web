"""CET4 Data Schema v1 validation. Unknown extension fields are retained."""
import math
import re
from datetime import date, datetime

STATUSES = {'new', 'learning', 'fuzzy', 'confusing', 'mastered', 'suspended'}
RESULTS = {'correct', 'fuzzy', 'wrong', 'unknown'}
SOURCES = {'web', 'codex', 'manual', 'import'}
DEFAULT_CONFIG = {'daily_limit': 30, 'backup_limit': 30, 'slow_response_ms': 5000}


def ensure(condition, message):
    if not condition:
        raise ValueError(message)


def number(value, integer=False):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0 and (not integer or int(value) == value)


def timestamp(value):
    try:
        return isinstance(value, str) and bool(re.match(r'^\d{4}-\d{2}-\d{2}T', value)) and bool(datetime.fromisoformat(value.replace('Z', '+00:00')))
    except ValueError:
        return False


def validate_review(r):
    ensure(isinstance(r, dict), 'Review must be an object')
    ensure(isinstance(r.get('id'), str) and r['id'], 'Review id missing')
    ensure(isinstance(r.get('word'), str) and r['word'], 'Review word missing')
    ensure(timestamp(r.get('time')), 'Invalid review time')
    ensure(r.get('result') in RESULTS and r.get('source') in SOURCES, 'Invalid review result/source')
    ensure(isinstance(r.get('answer'), str), 'Review answer must be text')
    ensure(r.get('response_ms') is None or number(r['response_ms']), 'Invalid response_ms')
    ensure('error_type' not in r or isinstance(r['error_type'], str), 'Invalid error_type')
    return r


def validate_config(c):
    ensure(isinstance(c, dict), 'Invalid config')
    for key, lo, hi in [('daily_limit', 5, 100), ('backup_limit', 5, 100), ('slow_response_ms', 1000, 30000)]:
        ensure(number(c.get(key), True) and lo <= c[key] <= hi, f'Invalid config: {key}')
    return c


def validate(data):
    ensure(isinstance(data, dict), 'Library must be an object')
    ensure(data.get('schema_version') == 1 and type(data['schema_version']) is int, 'Only schema_version 1 is supported; migrate explicitly')
    ensure(number(data.get('revision'), True), 'Invalid revision')
    ensure(timestamp(data.get('updated_at')), 'Invalid updated_at')
    ensure(data.get('updated_by') in SOURCES | {'migration'}, 'Invalid updated_by')
    ensure(isinstance(data.get('words'), dict), 'words must be an object')
    for key, w in data['words'].items():
        ensure(isinstance(w, dict), f'Invalid word: {key}')
        ensure(key == w.get('word') and bool(re.fullmatch(r"[a-z]+(?:[ '-][a-z]+)*", key)) and key not in {'__proto__', 'constructor', 'prototype'}, f'Invalid word key: {key}')
        ensure(isinstance(w.get('core_meaning'), str) and w['core_meaning'], f'Missing meaning: {key}')
        ensure(w.get('status') in STATUSES, f'Invalid status: {key}')
        for field in ['phonetic', 'notes']:
            ensure(isinstance(w.get(field), str), f'Invalid {field}: {key}')
        for field in ['tags', 'confused_with', 'synonyms', 'antonyms', 'word_family', 'collocations']:
            ensure(isinstance(w.get(field), list) and all(isinstance(v, str) for v in w[field]), f'Invalid {field}: {key}')
        ensure(isinstance(w.get('meanings'), list), f'Invalid meanings: {key}')
        for m in w['meanings']:
            ensure(isinstance(m, dict) and isinstance(m.get('pos'), str) and isinstance(m.get('zh'), str) and type(m.get('primary')) is bool, f'Invalid meaning: {key}')
        ensure(isinstance(w.get('wrong_answers'), dict) and all(number(n, True) for n in w['wrong_answers'].values()), f'Invalid wrong_answers: {key}')
        s = w.get('stats', {})
        ensure(isinstance(s, dict) and all(number(s.get(f), True) for f in ['seen', 'correct', 'wrong', 'fuzzy', 'streak', 'lapses']), f'Invalid stats: {key}')
        ensure(s['seen'] == s['correct'] + s['wrong'] + s['fuzzy'] and s['streak'] <= s['correct'], f'Inconsistent stats: {key}')
        ensure('avg_response_ms' in s and (s['avg_response_ms'] is None or number(s['avg_response_ms'])), f'Invalid average: {key}')
        ensure('response_count' not in s or (number(s['response_count'], True) and s['response_count'] <= s['seen']), f'Invalid response_count: {key}')
        schedule = w.get('schedule', {})
        ensure(isinstance(schedule, dict) and number(schedule.get('stage'), True) and number(schedule.get('interval_days'), True), f'Invalid schedule: {key}')
        due = schedule.get('due_at')
        ensure(isinstance(due, str) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', due)), f'Invalid due_at: {key}')
        date.fromisoformat(due)
        for field in ['created_at', 'updated_at']:
            ensure(timestamp(w.get(field)), f'Invalid {field}: {key}')
        ensure('last_review' in w, f'Missing last_review: {key}')
        if w['last_review'] is not None:
            r = w['last_review']
            ensure(isinstance(r, dict) and r.get('result') in RESULTS and isinstance(r.get('answer'), str) and timestamp(r.get('at')), f'Invalid last_review: {key}')
            ensure('response_ms' in r and (r['response_ms'] is None or number(r['response_ms'])), f'Invalid response_ms: {key}')
    return data
