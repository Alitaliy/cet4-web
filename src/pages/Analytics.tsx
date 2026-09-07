import { useState } from 'react';
import { useVocabulary } from '../context';
import { accuracy } from '../algorithms';
import {
  STATUSES,
  STATUS_LABEL,
  RESULT_LABEL,
  localDay,
  addDays,
  type Word,
  type Result,
} from '../models';
import { PageTitle, TrendChart, Heatmap, Progress, Empty } from '../components/UI';
import { Search, Download } from 'lucide-react';
import { download } from '../services/importExport';

export function Analytics({ editWord }: { editWord: (w: Word) => void }) {
  const { library, reviews } = useVocabulary();
  const [days, setDays] = useState(14);
  const words = Object.values(library.words);
  const recent = reviews.filter((r) => localDay(new Date(r.time)) >= addDays(localDay(), 1 - days));
  const measured = recent.filter((r) => typeof r.response_ms === 'number');
  const slow = words
    .filter((w) => w.stats.avg_response_ms !== null)
    .sort((a, b) => (b.stats.avg_response_ms || 0) - (a.stats.avg_response_ms || 0))
    .slice(0, 8);
  const lapses = words
    .filter((w) => w.stats.lapses > 0)
    .sort((a, b) => b.stats.lapses - a.stats.lapses)
    .slice(0, 8);
  return (
    <>
      <PageTitle
        eyebrow="YOUR PROGRESS, MADE VISIBLE"
        title="成长，有迹可循。"
        description="看见记忆的变化，也找到下一步值得努力的方向。"
        actions={
          <div className="segmented">
            {[7, 14, 30].map((d) => (
              <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
                近 {d} 天
              </button>
            ))}
          </div>
        }
      />
      <div className="stats-grid">
        {[
          { label: '复习次数', value: recent.length, unit: '次' },
          {
            label: '正确率',
            value: recent.length ? accuracy(recent) : '—',
            unit: recent.length ? '%' : '',
          },
          {
            label: '平均反应',
            value: measured.length
              ? (
                  measured.reduce((s, r) => s + (r.response_ms || 0), 0) /
                  measured.length /
                  1000
                ).toFixed(1)
              : '—',
            unit: measured.length ? '秒' : '',
          },
          {
            label: '学习天数',
            value: new Set(recent.map((r) => localDay(new Date(r.time)))).size,
            unit: '天',
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">{s.label}</div>
            <div className="stat-value">
              {s.value}
              <span>{s.unit}</span>
            </div>
            <div className="stat-note">最近 {days} 天</div>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <section className="panel">
          <div className="section-head">
            <h3>正确率与复习量</h3>
            <span className="small-label">近 {days} 天</span>
          </div>
          <TrendChart reviews={reviews} days={days} />
        </section>
        <section className="panel">
          <div className="section-head">
            <h3>词库状态分布</h3>
            <span className="small-label">{words.length} 个词</span>
          </div>
          <div className="distribution">
            {STATUSES.map((s) => (
              <div key={s}>
                <span>{STATUS_LABEL[s]}</span>
                <Progress
                  value={
                    words.length
                      ? (words.filter((w) => w.status === s).length / words.length) * 100
                      : 0
                  }
                  className={s}
                />
                <strong>{words.filter((w) => w.status === s).length}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="two-columns">
        <section className="panel">
          <div className="section-head">
            <div>
              <h3>还需要一点提取速度</h3>
              <p>平均反应最慢的词</p>
            </div>
          </div>
          {slow.map((w) => (
            <button className="ranking-row" key={w.word} onClick={() => editWord(w)}>
              <strong>{w.word}</strong>
              <span>{w.core_meaning}</span>
              <b>{((w.stats.avg_response_ms || 0) / 1000).toFixed(1)}s</b>
            </button>
          ))}
          {!slow.length && <Empty title="还没有反应时间数据" text="在网页中复习后即可查看。" />}
        </section>
        <section className="panel">
          <div className="section-head">
            <div>
              <h3>再多见几次，就会熟悉</h3>
              <p>遗忘次数最多的词</p>
            </div>
          </div>
          {lapses.map((w) => (
            <button className="ranking-row" key={w.word} onClick={() => editWord(w)}>
              <strong>{w.word}</strong>
              <span>{w.core_meaning}</span>
              <b>{w.stats.lapses} 次</b>
            </button>
          ))}
          {!lapses.length && <Empty title="暂时没有遗忘记录" text="继续保持规律复习。" />}
        </section>
      </div>
      <section className="panel wide-heatmap">
        <div className="section-head">
          <h3>学习日历</h3>
        </div>
        <Heatmap reviews={reviews} />
      </section>
    </>
  );
}
export function HistoryPage() {
  const { reviews } = useVocabulary();
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('all');
  const [source, setSource] = useState('all');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const filtered = reviews
    .filter(
      (r) =>
        (result === 'all' || r.result === result) &&
        (source === 'all' || r.source === source) &&
        (!date || localDay(new Date(r.time)) === date) &&
        [r.word, r.answer].join(' ').toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.time.localeCompare(a.time));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const p = Math.min(page, pages);
  return (
    <>
      <PageTitle
        eyebrow="EVERY RECALL COUNTS"
        title="每一次回想，都记得。"
        description="网页与 Skill 的学习记录汇集在这里，可以回看当时的答案与反应时间。"
        actions={
          <button
            className="button secondary"
            onClick={() =>
              download(
                filtered.map((r) => JSON.stringify(r)).join('\n') + '\n',
                'reviews.jsonl',
                'application/x-ndjson',
              )
            }
          >
            <Download size={16} />
            导出记录
          </button>
        }
      />
      <section className="panel words-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="搜索复习记录"
              placeholder="搜索单词或历史答案…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="评分筛选"
            value={result}
            onChange={(e) => {
              setResult(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">全部评分</option>
            {Object.entries(RESULT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="来源筛选"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">所有来源</option>
            <option value="web">Web</option>
            <option value="codex">Codex Skill</option>
            <option value="manual">手动</option>
            <option value="import">导入</option>
          </select>
          <input
            type="date"
            aria-label="复习日期"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
          {date && (
            <button className="text-button" onClick={() => setDate('')}>
              清除日期
            </button>
          )}
        </div>
        <div className="table-scroll">
          <table className="word-table">
            <thead>
              <tr>
                <th>复习时间</th>
                <th>单词</th>
                <th>你的答案</th>
                <th>评分</th>
                <th>反应时间</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((p - 1) * 20, p * 20).map((r) => (
                <tr key={r.id}>
                  <td className="muted">{new Date(r.time).toLocaleString('zh-CN')}</td>
                  <td>
                    <strong>{r.word}</strong>
                  </td>
                  <td>{r.answer || <span className="muted">未作答</span>}</td>
                  <td>
                    <span className={`result-pill ${r.result}`}>
                      {RESULT_LABEL[r.result as Result]}
                    </span>
                  </td>
                  <td>
                    {r.response_ms == null ? '未测量' : (r.response_ms / 1000).toFixed(1) + 's'}
                  </td>
                  <td>
                    <span className="source-tag">
                      {r.source === 'codex' ? 'Codex Skill' : r.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty title="没有匹配的复习记录" text="完成练习后，记录会出现在这里。" />
        )}
        <div className="pagination">
          <span>共 {filtered.length} 条记录</span>
          <div>
            <button disabled={p <= 1} onClick={() => setPage(p - 1)}>
              上一页
            </button>
            <span>
              {p} / {pages}
            </span>
            <button disabled={p >= pages} onClick={() => setPage(p + 1)}>
              下一页
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
