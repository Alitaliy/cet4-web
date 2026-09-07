import { useMemo, useState } from 'react';
import { Search, Plus, Download, ArrowUpDown, Trash2, X, SlidersHorizontal } from 'lucide-react';
import { useVocabulary } from '../context';
import { STATUSES, STATUS_LABEL, localDay, newWord, type Word, type Status } from '../models';
import { Badge, Empty, Modal, PageTitle, Speak } from '../components/UI';
import { download, exportCSV } from '../services/importExport';

export function Words({ editWord, addWord }: { editWord: (w: Word) => void; addWord: () => void }) {
  const { library, commit, busy } = useVocabulary();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [tag, setTag] = useState('all');
  const [due, setDue] = useState(false);
  const [confusing, setConfusing] = useState(false);
  const [sort, setSort] = useState('word');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const words = Object.values(library.words);
  const tags = [...new Set(words.flatMap((w) => w.tags))].sort();
  const filtered = useMemo(
    () =>
      words
        .filter(
          (w) =>
            (status === 'all' || w.status === status) &&
            (tag === 'all' || w.tags.includes(tag)) &&
            (!due || (w.schedule.due_at <= localDay() && w.status !== 'suspended')) &&
            (!confusing || w.confused_with.length > 0) &&
            [
              w.word,
              w.core_meaning,
              ...w.meanings.map((m) => m.zh),
              ...w.synonyms,
              ...w.confused_with,
              ...w.tags,
              w.notes,
            ]
              .join(' ')
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'wrong'
            ? b.stats.wrong - a.stats.wrong
            : sort === 'due'
              ? a.schedule.due_at.localeCompare(b.schedule.due_at)
              : a.word.localeCompare(b.word),
        ),
    [library, search, status, tag, due, confusing, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const activePage = Math.min(page, pages);
  const visible = filtered.slice((activePage - 1) * 12, activePage * 12);
  async function bulkStatus(nextStatus: Status) {
    const next = structuredClone(library);
    selected.forEach((key) => {
      if (next.words[key]) {
        next.words[key].status = nextStatus;
        next.words[key].updated_at = new Date().toISOString();
      }
    });
    if (await commit(next)) setSelected(new Set());
  }
  async function remove() {
    const next = structuredClone(library);
    selected.forEach((key) => delete next.words[key]);
    Object.values(next.words).forEach(
      (w) => (w.confused_with = w.confused_with.filter((key) => !selected.has(key))),
    );
    if (await commit(next, [], '已删除所选单词，历史记录仍保留。')) {
      setSelected(new Set());
      setDeleteOpen(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR WORD COLLECTION"
        title="一点一点，积累成词库。"
        description={`这里收藏了 ${words.length} 个词，也记录着你与它们慢慢熟悉的过程。`}
        actions={
          <>
            <button
              className="button secondary"
              onClick={() => download(exportCSV(filtered), 'words.csv', 'text/csv')}
            >
              <Download size={16} />
              导出筛选结果
            </button>
            <button className="button primary" onClick={addWord}>
              <Plus size={17} />
              添加单词
            </button>
          </>
        }
      />
      <section className="panel words-panel">
        <div className="filter-tabs">
          {['all', ...STATUSES].map((s) => (
            <button
              key={s}
              className={status === s ? 'active' : ''}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s === 'all' ? '全部单词' : STATUS_LABEL[s as Status]}
              <span>{s === 'all' ? words.length : words.filter((w) => w.status === s).length}</span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="搜索单词"
              placeholder="搜索单词、中文释义、标签或笔记…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button className="icon-button" onClick={() => setSearch('')} aria-label="清空搜索">
                <X size={15} />
              </button>
            )}
          </div>
          <select
            aria-label="标签筛选"
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">所有标签</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <label className="check-label">
            <input
              type="checkbox"
              checked={due}
              onChange={(e) => {
                setDue(e.target.checked);
                setPage(1);
              }}
            />
            仅到期
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confusing}
              onChange={(e) => {
                setConfusing(e.target.checked);
                setPage(1);
              }}
            />
            有易混词
          </label>
          <select aria-label="排序方式" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="word">字母顺序</option>
            <option value="wrong">错误次数 ↓</option>
            <option value="due">复习日期 ↑</option>
          </select>
        </div>
        {!!selected.size && (
          <div className="bulk-bar">
            <strong>已选 {selected.size} 项</strong>
            <select
              aria-label="批量修改状态"
              value=""
              onChange={(e) => {
                if (e.target.value) void bulkStatus(e.target.value as Status);
              }}
              disabled={busy}
            >
              <option value="">修改状态…</option>
              {STATUSES.map((s) => (
                <option value={s} key={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button
              className="text-button danger-text"
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={15} />
              删除
            </button>
            <button className="text-button" onClick={() => setSelected(new Set())}>
              取消选择
            </button>
          </div>
        )}
        <div className="table-scroll">
          <table className="word-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="选择本页所有单词"
                    checked={visible.length > 0 && visible.every((w) => selected.has(w.word))}
                    onChange={(e) => {
                      const set = new Set(selected);
                      visible.forEach((w) =>
                        e.target.checked ? set.add(w.word) : set.delete(w.word),
                      );
                      setSelected(set);
                    }}
                  />
                </th>
                <th>
                  <button onClick={() => setSort('word')}>
                    单词 <ArrowUpDown size={12} />
                  </button>
                </th>
                <th>核心词义</th>
                <th>学习状态</th>
                <th>正确率</th>
                <th>连对 / 错误</th>
                <th>下次复习</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((w) => (
                <tr key={w.word}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`选择 ${w.word}`}
                      checked={selected.has(w.word)}
                      onChange={(e) => {
                        const set = new Set(selected);
                        e.target.checked ? set.add(w.word) : set.delete(w.word);
                        setSelected(set);
                      }}
                    />
                  </td>
                  <td>
                    <button className="word-link" onClick={() => editWord(w)}>
                      {w.word}
                    </button>
                    <small className="word-pos">{w.meanings[0]?.pos}</small>
                  </td>
                  <td className="meaning-cell">{w.core_meaning}</td>
                  <td>
                    <Badge status={w.status} />
                  </td>
                  <td>
                    {w.stats.seen ? (
                      `${Math.round((w.stats.correct / w.stats.seen) * 100)}%`
                    ) : (
                      <span className="muted">未测试</span>
                    )}
                  </td>
                  <td>
                    <span className="streak-count">{w.stats.streak}</span>
                    <span className="muted"> / </span>
                    {w.stats.wrong}
                  </td>
                  <td>
                    <span className={w.schedule.due_at <= localDay() ? 'due-date' : 'muted'}>
                      {w.status === 'suspended'
                        ? '已暂停'
                        : w.schedule.due_at === localDay()
                          ? '今天'
                          : w.schedule.due_at < localDay()
                            ? '已到期'
                            : w.schedule.due_at.slice(5)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`编辑 ${w.word}`}
                      onClick={() => editWord(w)}
                    >
                      <SlidersHorizontal size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty title="没有找到匹配的单词" text="换一个关键词，或调整筛选条件。" />
        )}
        <div className="pagination">
          <span>共 {filtered.length} 个单词</span>
          <div>
            <button disabled={activePage <= 1} onClick={() => setPage(activePage - 1)}>
              上一页
            </button>
            <span>
              {activePage} / {pages}
            </span>
            <button disabled={activePage >= pages} onClick={() => setPage(activePage + 1)}>
              下一页
            </button>
          </div>
        </div>
      </section>
      {deleteOpen && (
        <Modal title={`删除 ${selected.size} 个单词？`} onClose={() => setDeleteOpen(false)}>
          <div className="modal-body">
            <p>词库中的所选单词和对应的易混关系将被移除。复习历史保留；目录模式下会先创建备份。</p>
            <div className="dialog-actions">
              <button className="button secondary" onClick={() => setDeleteOpen(false)}>
                取消
              </button>
              <button className="button danger" disabled={busy} onClick={() => void remove()}>
                确认删除
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
export function WordEditor({ word, onClose }: { word: Word | null; onClose: () => void }) {
  const { library, reviews, commit, busy, error } = useVocabulary();
  const [draft, setDraft] = useState<Word>(() => structuredClone(word || newWord('', '')));
  const [tags, setTags] = useState(draft.tags.join(', '));
  const [confusions, setConfusions] = useState(draft.confused_with.join(', '));
  const [synonyms, setSynonyms] = useState(draft.synonyms.join(', '));
  const [collocations, setCollocations] = useState(draft.collocations.join('\n'));
  const [localError, setLocalError] = useState('');
  const change = (key: keyof Word, value: unknown) => setDraft((w) => ({ ...w, [key]: value }));
  const split = (s: string) => [
    ...new Set(
      s
        .split(/[,，;；\n]/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');
    const key = draft.word.trim().toLowerCase();
    if (!word && library.words[key]) {
      setLocalError('此单词已存在，请编辑已有条目。');
      return;
    }
    const next = structuredClone(library);
    const peers = split(confusions)
      .map((s) => s.toLowerCase())
      .filter((s) => s !== key);
    next.words[key] = {
      ...draft,
      word: key,
      core_meaning: draft.core_meaning.trim(),
      meanings: [
        {
          ...(draft.meanings[0] || {}),
          pos: draft.meanings[0]?.pos || '',
          zh: draft.core_meaning.trim(),
          primary: true,
        },
        ...draft.meanings.slice(1),
      ],
      tags: split(tags),
      confused_with: peers,
      synonyms: split(synonyms),
      collocations: split(collocations),
      updated_at: new Date().toISOString(),
    };
    for (const old of word?.confused_with || [])
      if (!peers.includes(old) && next.words[old])
        next.words[old].confused_with = next.words[old].confused_with.filter((w) => w !== key);
    for (const peer of peers)
      if (next.words[peer])
        next.words[peer].confused_with = [...new Set([...next.words[peer].confused_with, key])];
    if (await commit(next)) onClose();
  }
  const history = reviews
    .filter((r) => r.word === word?.word)
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 6);
  return (
    <Modal title={word ? '单词详情' : '拾起一个新词'} onClose={onClose} wide>
      <form className="modal-body" onSubmit={save}>
        <div className="word-detail-title">
          <div>
            <h2>{draft.word || 'A new beginning.'}</h2>
            <span>{draft.phonetic || '每一个词，都是新的可能。'}</span>
          </div>
          {word && <Speak word={word.word} />}
        </div>
        <div className="form-grid">
          <label>
            英文单词
            <input
              required
              value={draft.word}
              readOnly={!!word}
              placeholder="例如 consequence"
              onChange={(e) => change('word', e.target.value)}
            />
          </label>
          <label>
            学习状态
            <select value={draft.status} onChange={(e) => change('status', e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="span-two">
            核心词义
            <input
              required
              value={draft.core_meaning}
              placeholder="后果；结果"
              onChange={(e) => change('core_meaning', e.target.value)}
            />
          </label>
          <label>
            词性
            <input
              value={draft.meanings[0]?.pos || ''}
              placeholder="n. / v. / adj."
              onChange={(e) =>
                change('meanings', [
                  { pos: e.target.value, zh: draft.core_meaning, primary: true },
                  ...draft.meanings.slice(1),
                ])
              }
            />
          </label>
          <label>
            音标
            <input
              value={draft.phonetic}
              placeholder="/…/"
              onChange={(e) => change('phonetic', e.target.value)}
            />
          </label>
          <label>
            易混词
            <input
              value={confusions}
              onChange={(e) => setConfusions(e.target.value)}
              placeholder="逗号分隔，如 conclusion"
            />
          </label>
          <label>
            同义 / 近义词
            <input
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
              placeholder="result, outcome"
            />
          </label>
          <label>
            标签
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="CET4, 高频"
            />
          </label>
          <label>
            下次复习
            <input
              type="date"
              required
              value={draft.schedule.due_at}
              onChange={(e) => change('schedule', { ...draft.schedule, due_at: e.target.value })}
            />
          </label>
          <label className="span-two">
            常用搭配
            <textarea
              aria-label="常用搭配"
              value={collocations}
              onChange={(e) => setCollocations(e.target.value)}
              rows={2}
              placeholder="每行一个搭配"
            />
          </label>
          <label className="span-two">
            我的笔记
            <textarea
              aria-label="我的笔记"
              value={draft.notes}
              onChange={(e) => change('notes', e.target.value)}
              rows={3}
              placeholder="记录一个联想，或记下容易混淆的地方。"
            />
          </label>
        </div>
        {word && (
          <>
            <div className="detail-stats">
              <span>
                正确 / 测试
                <strong>
                  {word.stats.correct} / {word.stats.seen}
                </strong>
              </span>
              <span>
                连续正确<strong>{word.stats.streak}</strong>
              </span>
              <span>
                平均反应
                <strong>
                  {word.stats.avg_response_ms === null
                    ? '—'
                    : (word.stats.avg_response_ms / 1000).toFixed(1) + 's'}
                </strong>
              </span>
              <span>
                遗忘次数<strong>{word.stats.lapses}</strong>
              </span>
            </div>
            {Object.keys(word.wrong_answers).length > 0 && (
              <div className="wrong-answer-list">
                <h4>历史错误答案</h4>
                {Object.entries(word.wrong_answers).map(([answer, n]) => (
                  <span key={answer}>
                    {answer} <b>× {n}</b>
                  </span>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <div className="detail-history">
                <h4>最近复习</h4>
                {history.map((r) => (
                  <div key={r.id}>
                    <span>{new Date(r.time).toLocaleString('zh-CN')}</span>
                    <span>{r.answer || '未作答'}</span>
                    <span className={`result-text ${r.result}`}>
                      {{ correct: '正确', fuzzy: '模糊', wrong: '错误', unknown: '不会' }[r.result]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {(localError || error) && (
          <p className="form-error" role="alert">
            {localError || error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? '正在保存…' : '保存单词'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
