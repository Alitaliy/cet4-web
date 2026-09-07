import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  Flame,
  Target,
  Shuffle,
  CalendarDays,
  Sprout,
  Sparkles,
} from 'lucide-react';
import { useVocabulary } from '../context';
import { localDay, type Word } from '../models';
import { accuracy, buildQueue, streakDays, priority } from '../algorithms';
import { PageTitle, TrendChart, Heatmap, Progress, WordMini, Empty } from '../components/UI';

export function Dashboard({
  navigate,
  startReview,
  editWord,
}: {
  navigate: (page: string) => void;
  startReview: (mode?: 'daily' | 'mistakes' | 'confusions') => void;
  editWord: (w: Word) => void;
}) {
  const { library, reviews, config, mode } = useVocabulary();
  const words = Object.values(library.words);
  const queue = buildQueue(words, config.daily_limit);
  const today = reviews.filter((r) => localDay(new Date(r.time)) === localDay());
  const todayUnique = new Set(today.map((r) => r.word)).size;
  const mastered = words.filter((w) => w.status === 'mastered').length;
  const learning = words.filter((w) =>
    ['learning', 'fuzzy', 'confusing'].includes(w.status),
  ).length;
  const pairs = words
    .filter((w) => w.confused_with.length && w.word.localeCompare(w.confused_with[0]) < 0)
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, 3);
  const focus = words
    .filter((w) => w.status !== 'suspended')
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, 4);
  const stats = [
    {
      icon: Target,
      label: '今日待复习',
      value: words.filter((w) => w.status !== 'suspended' && w.schedule.due_at <= localDay())
        .length,
      unit: '词',
      note: `${queue.length} 词已为你安排好`,
      color: 'sage',
    },
    {
      icon: BookOpen,
      label: '正在学习',
      value: learning,
      unit: '词',
      note: `词库共 ${words.length} 个单词`,
      color: 'sand',
    },
    {
      icon: CheckCheck,
      label: '稳定掌握',
      value: mastered,
      unit: '词',
      note: `占词库 ${words.length ? Math.round((mastered / words.length) * 100) : 0}%`,
      color: 'blue',
    },
    {
      icon: Flame,
      label: '连续学习',
      value: streakDays(reviews),
      unit: '天',
      note: today.length ? '今天也在慢慢进步' : '从今天开始，积少成多',
      color: 'peach',
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="YOUR LEARNING SPACE"
        title="每一天，都更进一步。"
        description="把模糊的印象，变成清晰的记忆。今天也来拾起几个词吧。"
        actions={
          <div className="date-chip">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </div>
        }
      />
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <span className={`stat-icon ${s.color}`}>
                <s.icon size={18} />
              </span>
            </div>
            <div className="stat-value">
              {s.value}
              <span>{s.unit}</span>
            </div>
            <div className="stat-note">{s.note}</div>
          </div>
        ))}
      </div>
      <div className="dashboard-main">
        <section className="review-hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span className="tiny-spark">✳</span> A LITTLE EVERY DAY
            </span>
            <h2>
              让记忆，
              <br />
              在复习中生长。
            </h2>
            <p>
              到期的旧词，值得辨清的易混词，
              <br />
              还有一点新收获。下一组已经准备好了。
            </p>
            <button className="button lime" onClick={() => startReview()}>
              开始今日复习 <ArrowRight size={18} />
            </button>
            <div className="hero-meta">
              <span>
                <BookOpen size={14} /> {queue.length} 个单词
              </span>
              <span>约 {Math.max(1, Math.ceil(queue.length / 5))} 分钟</span>
            </div>
          </div>
          <div className="plant-art" aria-hidden="true">
            <div className="orb orb-one" />
            <div className="orb orb-two" />
            <div className="stem" />
            <div className="leaf leaf-one" />
            <div className="leaf leaf-two" />
            <div className="leaf leaf-three" />
            <div className="leaf leaf-four" />
            <div className="plant-book">
              <span>
                grow
                <br />
                <i>at your pace.</i>
              </span>
            </div>
            <div className="plant-dot dot-one" />
            <div className="plant-dot dot-two" />
            <span className="art-star">✳</span>
          </div>
        </section>
        <section className="panel today-panel">
          <div className="section-head">
            <h3>今日小目标</h3>
            <span className="small-label">DAILY GOAL</span>
          </div>
          <div
            className="goal-ring"
            style={
              {
                '--progress': `${Math.min(100, (todayUnique / config.daily_limit) * 100)}%`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>
                {todayUnique}
                <span> / {config.daily_limit}</span>
              </strong>
              <small>今日已复习</small>
            </div>
          </div>
          <p className="goal-caption">
            {todayUnique >= config.daily_limit
              ? '今日目标达成，好好奖励自己。'
              : `再拾起 ${config.daily_limit - todayUnique} 个词，就离目标更近一步。`}
          </p>
          <div className="today-details">
            <span>
              今日正确率<strong>{today.length ? accuracy(today) + '%' : '—'}</strong>
            </span>
            <span>
              复习次数
              <strong>
                {today.length}
                <small> 次</small>
              </strong>
            </span>
          </div>
        </section>
      </div>
      <div className="dashboard-middle">
        <section className="panel">
          <div className="section-head">
            <div>
              <h3>看见每一点进步</h3>
              <p>最近 14 天的复习表现{mode === 'demo' ? ' · 演示数据' : ''}</p>
            </div>
            <button className="text-button" onClick={() => navigate('analytics')}>
              学习统计 <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot" />
              正确率
            </span>
            <span>
              <i className="legend-square" />
              复习量
            </span>
          </div>
          <TrendChart reviews={reviews} />
        </section>
        <section className="panel">
          <div className="section-head">
            <div>
              <h3>记忆的足迹</h3>
              <p>每一次练习，都有迹可循</p>
            </div>
            <Sprout size={20} className="muted-green" />
          </div>
          <Heatmap reviews={reviews} />
          <div className="learning-summary">
            <div>
              <span className="summary-number">
                {new Set(reviews.map((r) => localDay(new Date(r.time)))).size}
              </span>
              <span>个学习日</span>
            </div>
            <div>
              <span className="summary-number">{reviews.length}</span>
              <span>次认真回想</span>
            </div>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="section-head">
            <div>
              <h3>
                <Shuffle size={17} /> 这些词，值得分清
              </h3>
              <p>一次对比，修正一个容易走错的记忆路口</p>
            </div>
            <button className="text-button" onClick={() => navigate('confusions')}>
              全部易混词 <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="pair-previews">
            {pairs.map((w) => (
              <button key={w.word} className="pair-preview" onClick={() => navigate('confusions')}>
                <div>
                  <strong>{w.word}</strong>
                  <span>{w.core_meaning.split('；')[0]}</span>
                </div>
                <span className="vs">↔</span>
                <div>
                  <strong>{w.confused_with[0]}</strong>
                  <span>
                    {library.words[w.confused_with[0]]?.core_meaning.split('；')[0] || '待补充词义'}
                  </span>
                </div>
              </button>
            ))}
            {!pairs.length && <Empty title="暂时没有易混词" text="可在单词详情中添加易混关系。" />}
          </div>
        </section>
        <section className="panel focus-panel">
          <div className="section-head">
            <h3>
              <Sparkles size={17} /> 今日重点
            </h3>
            <span className="small-label">FOCUS</span>
          </div>
          {focus.map((w) => (
            <WordMini key={w.word} word={w} onClick={() => editWord(w)} />
          ))}
          {!focus.length && <Empty />}
        </section>
      </div>
      <div className="daily-quote">
        <span>“</span> Great things are done by a series of small things brought together.
        <small>每一小步，都算数。</small>
      </div>
    </>
  );
}
