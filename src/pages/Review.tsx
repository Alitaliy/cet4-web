import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CircleHelp,
  X,
  Timer,
  CheckCheck,
  RotateCcw,
  Leaf,
} from 'lucide-react';
import { useVocabulary } from '../context';
import { applyReview, buildQueue, meaningMatches } from '../algorithms';
import { RESULT_LABEL, type Result, type Word } from '../models';
import { Empty, PageTitle, Progress, Speak, SavedCheck } from '../components/UI';

export function ReviewPage({
  mode,
  navigate,
}: {
  mode: 'daily' | 'mistakes' | 'confusions';
  navigate: (s: string) => void;
}) {
  const { library, config, commit, busy, mode: storageMode } = useVocabulary();
  const [queue, setQueue] = useState(() =>
    buildQueue(Object.values(library.words), config.daily_limit, mode).map((w) => w.word),
  );
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState<Result | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [repeated, setRepeated] = useState<Set<string>>(new Set());
  const started = useRef(performance.now());
  const input = useRef<HTMLInputElement>(null);
  const word = library.words[queue[index]];
  const done = index >= queue.length;
  useEffect(() => {
    started.current = performance.now();
    input.current?.focus();
  }, [index]);
  function reveal(e?: React.FormEvent) {
    e?.preventDefault();
    setElapsed(Math.round(performance.now() - started.current));
    setRevealed(true);
  }
  async function grade(result: Result) {
    if (!word || saved || busy) return;
    const next = structuredClone(library);
    const { word: updated, review } = applyReview(word, result, answer, elapsed, config);
    if (result === 'wrong' && answer.trim()) {
      const peer = Object.values(next.words).find(
        (w) => w.word !== word.word && meaningMatches(answer, w) && !word.synonyms.includes(w.word),
      );
      if (peer) {
        updated.confused_with = [...new Set([...updated.confused_with, peer.word])];
        updated.status = 'confusing';
        peer.confused_with = [...new Set([...peer.confused_with, word.word])];
        peer.updated_at = review.time;
        review.error_type = 'semantic_confusion';
      }
    }
    next.words[word.word] = updated;
    if (await commit(next, [review], '本题已保存到词库和复习历史。')) {
      setSaved(result);
      setResults((old) => [...old, result]);
      if ((result === 'wrong' || result === 'unknown') && !repeated.has(word.word)) {
        setQueue((old) => [...old, word.word]);
        setRepeated((old) => new Set([...old, word.word]));
      }
    }
  }
  function next() {
    setIndex((i) => i + 1);
    setAnswer('');
    setRevealed(false);
    setSaved(null);
  }
  const name =
    mode === 'mistakes' ? '错词专项复习' : mode === 'confusions' ? '易混词专项复习' : '今日复习';
  if (!queue.length)
    return (
      <>
        <PageTitle
          eyebrow="TIME TO RECALL"
          title={name}
          description="给记忆一点时间，也给自己一点耐心。"
        />
        <section className="panel">
          <Empty
            title="当前没有需要复习的单词"
            text="可以添加新词、调整复习日期，或稍后再来。"
            action={
              <button className="button primary" onClick={() => navigate('words')}>
                前往单词库 <ArrowRight size={16} />
              </button>
            }
          />
        </section>
      </>
    );
  if (done)
    return (
      <>
        <PageTitle
          eyebrow="A LITTLE PROGRESS"
          title="这一轮，完成了。"
          description="每一次努力回想，都会让记忆更牢固一点。"
        />
        <section className="panel review-complete">
          <div className="complete-icon">
            <CheckCheck size={42} />
          </div>
          <h2>又把 {new Set(queue).size} 个词，往心里放了放。</h2>
          <p>
            {storageMode === 'folder'
              ? '本轮结果已保存，下次复习也安排好了。'
              : storageMode === 'demo'
                ? '你完成了一次演示练习。连接本地目录后就能长期保存学习进度。'
                : '请前往导入导出页，保存这一轮的学习存档。'}
          </p>
          <div className="complete-stats">
            {(['correct', 'fuzzy', 'wrong', 'unknown'] as Result[]).map((r) => (
              <div key={r}>
                <strong className={`result-text ${r}`}>
                  {results.filter((v) => v === r).length}
                </strong>
                <span>{RESULT_LABEL[r]}</span>
              </div>
            ))}
          </div>
          <div className="button-row">
            <button className="button secondary" onClick={() => navigate('history')}>
              查看学习记录
            </button>
            <button
              className="button primary"
              onClick={() => navigate(storageMode === 'portable' ? 'transfer' : 'dashboard')}
            >
              {storageMode === 'portable' ? '导出学习存档' : '返回首页'}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </>
    );
  if (!word)
    return (
      <Empty
        title="这个单词已被移除"
        text="词库发生了变化。请返回首页重新安排复习。"
        action={
          <button className="button primary" onClick={() => navigate('dashboard')}>
            返回首页
          </button>
        }
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="TIME TO RECALL"
        title={name}
        description="先认真回想，再看答案。模糊也没关系，如实记录就好。"
        actions={
          <button className="button secondary" onClick={() => navigate('dashboard')}>
            <ArrowLeft size={16} />
            结束本轮
          </button>
        }
      />
      <div className="review-layout">
        <section className="panel review-card">
          <div className="review-progress-head">
            <span>
              记忆练习 <strong>{index + 1}</strong>
              <span className="muted"> / {queue.length}</span>
            </span>
            <span className="muted">
              {repeated.has(word.word) && index >= queue.indexOf(word.word) + 1
                ? '错词再遇见'
                : '英 → 中 · 核心识义'}
            </span>
          </div>
          <Progress value={(index / queue.length) * 100} />
          <div className="flash-word">
            <span className="eyebrow">TAKE YOUR TIME</span>
            <h2>{word.word}</h2>
            <div>
              {word.phonetic}
              <Speak word={word.word} />
            </div>
          </div>
          {!revealed ? (
            <form className="answer-form" onSubmit={reveal}>
              <label htmlFor="review-answer">它最核心的中文意思是？</label>
              <input
                ref={input}
                id="review-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoComplete="off"
                placeholder="写下你想到的意思…"
              />
              <button className="button primary" type="submit">
                查看答案 <ArrowRight size={17} />
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setAnswer('');
                  reveal();
                }}
              >
                暂时想不起来
              </button>
              <small>按 Enter 查看答案，再选择最符合本次表现的评分</small>
            </form>
          ) : (
            <div className="answer-reveal">
              <div className="answer-comparison">
                <div>
                  <span>核心词义</span>
                  <strong>{word.core_meaning}</strong>
                </div>
                <div>
                  <span>你的回答</span>
                  <p>{answer || '暂时想不起来'}</p>
                </div>
              </div>
              <div className="answer-time">
                <Timer size={14} />
                回想用时 {(elapsed / 1000).toFixed(1)} 秒
                <span>
                  {answer && meaningMatches(answer, word)
                    ? '与已收录的核心释义匹配'
                    : '请对照词义，自行确认评分'}
                </span>
              </div>
              {word.confused_with.length > 0 && (
                <div className="confusion-hint">
                  <strong>别和它们混淆</strong>
                  {word.confused_with.map((peer) => (
                    <span key={peer}>
                      {peer} <b>→</b> {library.words[peer]?.core_meaning || '尚未收录词义'}
                    </span>
                  ))}
                </div>
              )}
              {typeof word.example === 'string' && word.example && (
                <div className="example">
                  <p>{word.example}</p>
                  <small>{String(word.translation || '')}</small>
                </div>
              )}
              {!saved ? (
                <>
                  <p className="grade-prompt">这一次，记得怎么样？</p>
                  <div className="grade-buttons">
                    {[
                      { result: 'correct', label: '记得很清楚', icon: Check },
                      { result: 'fuzzy', label: '有点模糊', icon: CircleHelp },
                      { result: 'wrong', label: '记错了', icon: X },
                      { result: 'unknown', label: '完全不会', icon: RotateCcw },
                    ].map((g) => (
                      <button
                        key={g.result}
                        className={`grade-button ${g.result}`}
                        disabled={busy}
                        onClick={() => void grade(g.result as Result)}
                      >
                        <g.icon size={19} />
                        <span>{g.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="next-row">
                  <span>
                    {storageMode === 'folder' ? <SavedCheck /> : '本题已记录'} ·{' '}
                    {RESULT_LABEL[saved]}
                  </span>
                  <button className="button primary" onClick={next}>
                    {index + 1 >= queue.length ? '查看本轮总结' : '下一个词'}
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        <aside className="review-aside">
          <div className="panel">
            <Leaf size={26} className="muted-green" />
            <h3>回想，比重读更有用。</h3>
            <p>给自己几秒钟。先从记忆里找一找，再揭开答案。</p>
            <div className="review-guidance">
              <span>
                <i className="dot correct" />
                正确
              </span>
              <p>能够准确想起核心词义。</p>
              <span>
                <i className="dot fuzzy" />
                模糊
              </span>
              <p>大致有印象，但不够确定。</p>
              <span>
                <i className="dot wrong" />
                错误 / 不会
              </span>
              <p>如实记录，错词会在本轮后段再出现一次。</p>
            </div>
          </div>
          <div className="session-note">
            本轮已完成 <strong>{results.length}</strong> 次回想
            <br />
            正确 <strong>{results.filter((r) => r === 'correct').length}</strong> 次 · 模糊{' '}
            <strong>{results.filter((r) => r === 'fuzzy').length}</strong> 次
          </div>
        </aside>
      </div>
    </>
  );
}
