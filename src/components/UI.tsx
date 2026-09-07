import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, ArrowUpRight, BookOpen, Volume2, Check } from 'lucide-react';
import { STATUS_LABEL, localDay, addDays, type Word, type Status, type Review } from '../models';
import { accuracy } from '../algorithms';

export function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status}`}>
      <span />
      {STATUS_LABEL[status]}
    </span>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function Empty({
  title = '这里还没有单词',
  text = '添加或导入词汇，开始积累自己的词库。',
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={36} strokeWidth={1.25} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && e.clientX !== 0) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="关闭">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Speak({ word }: { word: string }) {
  return (
    <button
      className="icon-button pronounce"
      title={`朗读 ${word}`}
      aria-label={`朗读 ${word}`}
      disabled={!('speechSynthesis' in window)}
      onClick={() => {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        speechSynthesis.speak(utterance);
      }}
    >
      <Volume2 size={18} />
    </button>
  );
}
export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`progress ${className}`}>
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function TrendChart({ reviews, days = 14 }: { reviews: Review[]; days?: number }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = chartRef.current!;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const points = Array.from({ length: days }, (_, i) => {
    const date = addDays(localDay(), i - days + 1);
    const rows = reviews.filter((r) => localDay(new Date(r.time)) === date);
    return { date, count: rows.length, rate: accuracy(rows) };
  });
  const w = width,
    h = 190,
    pad = 42;
  const tickCount = w < 400 ? 3 : 6;
  const tickIndexes = new Set(
    Array.from({ length: tickCount + 1 }, (_, i) => Math.round((i * (days - 1)) / tickCount)),
  );
  const x = (i: number) => pad + (i * (w - pad - 24)) / (days - 1);
  const y = (rate: number) => h - 30 - (rate / 100) * (h - 45);
  const path = points
    .map((p, i) => `${i === 0 || !points[i - 1].count ? 'M' : 'L'}${x(i)},${y(p.rate)}`)
    .filter((_, i) => points[i].count)
    .join(' ');
  const total = points.reduce((n, p) => n + p.count, 0);
  return (
    <div className="chart" ref={chartRef}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`最近 ${days} 天正确率；共 ${total} 次复习。鼠标悬停数据点查看每天数据。`}
      >
        {[0, 50, 100].map((n) => (
          <g key={n}>
            <line x1={pad} y1={y(n)} x2={w - 10} y2={y(n)} stroke="#e9ece6" strokeDasharray="4 5" />
            <text x={0} y={y(n) + 4} className="chart-label">
              {n}%
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.date}>
            <rect
              x={x(i) - 5}
              y={h - 30 - Math.min(p.count, 60) * 1.25}
              width="10"
              height={Math.min(p.count, 60) * 1.25}
              rx="3"
              fill="#e4ebda"
            >
              <title>
                {p.date}：{p.count} 次复习
              </title>
            </rect>
            {tickIndexes.has(i) && (
              <text x={x(i)} y={h - 5} textAnchor="middle" className="chart-label">
                {p.date.slice(5).replace('-', '/')}
              </text>
            )}
          </g>
        ))}
        <path d={path} fill="none" stroke="#547258" strokeWidth="2.5" strokeLinejoin="round" />
        {points
          .filter((p) => p.count > 0)
          .map((p) => (
            <circle
              key={p.date}
              cx={x(points.indexOf(p))}
              cy={y(p.rate)}
              r="4"
              fill="#547258"
              stroke="white"
              strokeWidth="2"
            >
              <title>
                {p.date}：正确率 {p.rate}%，{p.count} 次复习
              </title>
            </circle>
          ))}
      </svg>
      {!total && <div className="chart-no-data">完成首次复习后，这里会显示你的学习趋势。</div>}
    </div>
  );
}
export function Heatmap({ reviews }: { reviews: Review[] }) {
  const cells = Array.from({ length: 98 }, (_, i) => {
    const day = addDays(localDay(), i - 97);
    const count = reviews.filter((r) => localDay(new Date(r.time)) === day).length;
    return { day, count };
  });
  return (
    <>
      <div className="heatmap">
        {cells.map((c) => (
          <div
            key={c.day}
            className={`heat-cell level-${Math.min(4, Math.ceil(c.count / 10))}`}
            title={`${c.day} · ${c.count} 次复习`}
            aria-label={`${c.day} ${c.count} 次复习`}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>最近 14 周</span>
        <span>
          少{' '}
          {[0, 1, 2, 3, 4].map((n) => (
            <i className={`heat-cell level-${n}`} key={n} />
          ))}{' '}
          多
        </span>
      </div>
    </>
  );
}
export function WordMini({ word, onClick }: { word: Word; onClick: () => void }) {
  return (
    <button className="word-mini" onClick={onClick}>
      <span>
        <strong>{word.word}</strong>
        <small>{word.core_meaning}</small>
      </span>
      <Badge status={word.status} />
      <ArrowUpRight size={17} />
    </button>
  );
}
export function SavedCheck() {
  return (
    <span className="saved-check">
      <Check size={15} /> 已保存
    </span>
  );
}
