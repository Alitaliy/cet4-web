"""Shared, deterministic review policy (mirrors src/algorithms.ts)."""
from copy import deepcopy
from datetime import datetime, date, timedelta
from uuid import uuid4
from validator import RESULTS, DEFAULT_CONFIG, ensure, number


def now():
    return datetime.now().astimezone().isoformat(timespec='milliseconds')


def new_word(word, meaning, pos=''):
    at = now()
    return {'word': word.strip().lower(), 'phonetic': '', 'core_meaning': meaning.strip(), 'meanings': [{'pos': pos, 'zh': meaning.strip(), 'primary': True}], 'status': 'new', 'tags': ['CET4'], 'confused_with': [], 'wrong_answers': {}, 'synonyms': [], 'antonyms': [], 'word_family': [], 'collocations': [], 'stats': {'seen': 0, 'correct': 0, 'wrong': 0, 'fuzzy': 0, 'streak': 0, 'lapses': 0, 'avg_response_ms': None}, 'schedule': {'stage': 0, 'interval_days': 0, 'due_at': date.today().isoformat()}, 'last_review': None, 'created_at': at, 'updated_at': at, 'notes': ''}


def priority(w):
    return (100 if w['schedule']['due_at'] <= date.today().isoformat() else 0) + (45 if w['status'] == 'confusing' else 25 if w['status'] == 'fuzzy' else 0) + min(w['stats']['wrong'], 15) * 5 + (20 if (w['last_review'] or {}).get('result') in {'wrong', 'unknown'} else 0) + min((w['stats']['avg_response_ms'] or 0) / 1000, 20) - w['stats']['streak'] * 2


def queue(words, limit=30):
    active = sorted((w for w in words if w['status'] != 'suspended'), key=lambda w: (-priority(w), w['word']))
    due = [w for w in active if w['status'] != 'new' and w['schedule']['due_at'] <= date.today().isoformat()]
    difficult = [w for w in active if w['status'] in {'fuzzy', 'confusing'} or w['stats']['wrong'] > 1]
    fresh = [w for w in active if w['status'] == 'new']
    selected = []

    def take(pool, n):
        used = {w['word'] for w in selected}
        selected.extend([w for w in pool if w['word'] not in used][:max(0, n)])

    take(due, int(limit * .6))
    take(difficult, int(limit * .2))
    take(fresh, max(1, -(-limit // 5)))
    # Dedupe across pools when filling, as the JS implementation does.
    unique = {w['word']: w for w in due + difficult + fresh}
    take(list(unique.values()), limit - len(selected))
    return selected[:limit]


def apply_review(word, result, answer='', response_ms=None, config=None, time=None, source='codex'):
    ensure(result in RESULTS, 'Invalid review result')
    ensure(isinstance(answer, str), 'Answer must be text')
    ensure(response_ms is None or number(response_ms), 'Invalid response_ms')
    config = config or DEFAULT_CONFIG
    time = time or now()
    w = deepcopy(word)
    s = w['stats']
    measured = s.get('response_count', 0 if s['avg_response_ms'] is None else s['seen'])
    s['seen'] += 1
    if result == 'correct':
        s['correct'] += 1
        s['streak'] += 1
    else:
        s['streak'] = 0
        if result == 'fuzzy':
            s['fuzzy'] += 1
        else:
            s['wrong'] += 1
            s['lapses'] += 1
            if answer.strip():
                w['wrong_answers'][answer.strip()] = w['wrong_answers'].get(answer.strip(), 0) + 1
    if response_ms is not None:
        s['avg_response_ms'] = int(((s['avg_response_ms'] or 0) * measured + response_ms) / (measured + 1) + .5)
        s['response_count'] = measured + 1
    else:
        s['response_count'] = measured
    interval = [1, 2, 4, 7, 15, 30, 60][min(s['streak'], 7) - 1] if result == 'correct' else 1
    slow = response_ms is not None and response_ms > config['slow_response_ms']
    if slow and result == 'correct':
        interval = min(interval, 4)
    w['status'] = 'fuzzy' if result == 'fuzzy' else ('mastered' if s['streak'] >= 6 and not slow else 'learning') if result == 'correct' else ('confusing' if w['confused_with'] else 'learning')
    day = datetime.fromisoformat(time.replace('Z', '+00:00')).astimezone().date()
    w['schedule'] = {**w['schedule'], 'stage': min(s['streak'], 7) if result == 'correct' else max(0, w['schedule']['stage'] - 1), 'interval_days': interval, 'due_at': (day + timedelta(days=interval)).isoformat()}
    w['last_review'] = {'result': result, 'answer': answer, 'response_ms': response_ms, 'at': time}
    w['updated_at'] = time
    review = {'id': str(uuid4()), 'word': w['word'], 'time': time, 'result': result, 'answer': answer, 'response_ms': response_ms, 'source': source}
    if result == 'unknown':
        review['error_type'] = 'unknown_meaning'
    elif result == 'fuzzy':
        review['error_type'] = 'fuzzy_recall'
    elif slow and result == 'correct':
        review['error_type'] = 'slow_retrieval'
    return w, review
