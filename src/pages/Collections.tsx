import { useState } from 'react';
import { ArrowRight, Search, Shuffle, Flame, ArrowUpRight } from 'lucide-react';
import { useVocabulary } from '../context';
import { priority } from '../algorithms';
import { PageTitle, Empty, Badge, Speak } from '../components/UI';
import type { Word } from '../models';

export function Confusions({
  startReview,
  editWord,
}: {
  startReview: () => void;
  editWord: (w: Word) => void;
}) {
  const { library } = useVocabulary();
  const [search, setSearch] = useState('');
  const seen = new Set<string>();
  const pairs: { a: Word; b?: Word; name: string }[] = [];
  for (const a of Object.values(library.words))
    for (const name of a.confused_with) {
      const key = [a.word, name].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a, b: library.words[name], name });
    }
  const filtered = pairs.filter((p) =>
    [p.a.word, p.name, p.a.core_meaning, p.b?.core_meaning || '']
      .join(' ')
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="MAKE THE DIFFERENCE CLEAR"
        title="相似的词，不同的意思。"
        description={`共 ${pairs.length} 组易混关系。把错误的连接拆开，让每个词回到自己的位置。`}
        actions={
          <button className="button primary" onClick={startReview}>
            <Shuffle size={16} />
            开始易混专项 <ArrowRight size={16} />
          </button>
        }
      />
      <div className="collection-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="搜索易混词"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="查找一组易混词…"
          />
        </div>
        <span>{filtered.length} 组对比</span>
      </div>
      <div className="confusion-grid">
        {filtered.map(({ a, b, name }) => (
          <section className="panel confusion-card" key={[a.word, name].sort().join('|')}>
            <div className="pair-type">
              <Shuffle size={14} />
              易混辨析
              <button
                className="icon-button"
                aria-label={`编辑 ${a.word} 的易混关系`}
                onClick={() => editWord(a)}
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="confusion-word">
              <div>
                <button className="word-link" onClick={() => editWord(a)}>
                  {a.word}
                </button>
                <Speak word={a.word} />
                <p>
                  {a.meanings[0]?.pos} {a.core_meaning}
                </p>
              </div>
            </div>
            <div className="pair-divider">
              <span>不同的词，分开记</span>
              <b>≠</b>
            </div>
            <div className="confusion-word">
              <div>
                <button className="word-link" disabled={!b} onClick={() => b && editWord(b)}>
                  {name}
                </button>
                <Speak word={name} />
                <p>
                  {b?.meanings[0]?.pos} {b?.core_meaning || '词库中尚未收录，可在单词库添加'}
                </p>
              </div>
            </div>
            <div className="pair-note">
              {a.collocations[0] ||
                b?.collocations[0] ||
                `${a.word} → ${a.core_meaning.split('；')[0]}；${name} → ${b?.core_meaning.split('；')[0] || '待补充'}`}
            </div>
          </section>
        ))}
      </div>
      {!filtered.length && (
        <section className="panel">
          <Empty
            title="暂时没有匹配的易混词"
            text="在单词详情中添加易混对象，或在复习时记录错误映射。"
          />
        </section>
      )}
    </>
  );
}
export function Mistakes({
  startReview,
  editWord,
}: {
  startReview: () => void;
  editWord: (w: Word) => void;
}) {
  const { library } = useVocabulary();
  const words = Object.values(library.words)
    .filter((w) => w.stats.wrong > 0 || w.status === 'fuzzy')
    .sort((a, b) => priority(b) - priority(a));
  return (
    <>
      <PageTitle
        eyebrow="TURN MISTAKES INTO MEMORY"
        title="记错的地方，正是进步的起点。"
        description={`这里有 ${words.length} 个值得再见一面的词。优先照顾那些容易混淆、反复遗忘的词。`}
        actions={
          <button className="button primary" onClick={startReview}>
            <Flame size={16} />
            开始错词专项 <ArrowRight size={16} />
          </button>
        }
      />
      <section className="panel">
        <div className="section-head">
          <div>
            <h3>重点攻克</h3>
            <p>结合到期情况、错误次数、模糊程度与反应速度排序</p>
          </div>
          <Flame size={20} className="muted-green" />
        </div>
        <div className="mistake-list">
          {words.map((w, i) => (
            <button className="mistake-row" key={w.word} onClick={() => editWord(w)}>
              <span className={`rank ${i < 3 ? 'top' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
              <div className="mistake-word">
                <strong>{w.word}</strong>
                <span>{w.core_meaning}</span>
              </div>
              <Badge status={w.status} />
              <div className="mistake-count">
                <strong>{w.stats.wrong}</strong>
                <small>累计错误</small>
              </div>
              <div className="mistake-wrong">
                <small>曾经答成</small>
                <span>
                  {Object.entries(w.wrong_answers).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                    '词义模糊 / 未作答'}
                </span>
              </div>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
        {!words.length && (
          <Empty title="还没有错词记录" text="完成一次复习后，需要巩固的词会出现在这里。" />
        )}
      </section>
    </>
  );
}
