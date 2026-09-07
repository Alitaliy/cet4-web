import { useRef, useState } from 'react';
import {
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ArrowRight,
  Archive,
  Check,
  Info,
} from 'lucide-react';
import { useVocabulary } from '../context';
import {
  emptyLibrary,
  configSchema,
  reviewSchema,
  validateLibrary,
  type Word,
  type Library,
  type Review,
  type Config,
} from '../models';
import {
  parseImport,
  mergeWords,
  download,
  exportCSV,
  exportMarkdown,
} from '../services/importExport';
import { PageTitle, Modal } from '../components/UI';
import { starterLibrary } from '../seed';

export function Transfer() {
  const store = useVocabulary();
  const { library, reviews, mode, busy, commit, usePortable, setDirty, setError } = store;
  const file = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<{
    words: Word[];
    filename: string;
    library?: Library;
    reviews: Review[];
    config?: Config;
  }>();
  const [strategy, setStrategy] = useState<'skip' | 'merge' | 'overwrite'>('merge');
  const [dragging, setDragging] = useState(false);
  async function readFile(f?: File) {
    if (!f) return;
    try {
      if (f.size > 30 * 1024 * 1024) throw new Error('单次导入上限为 30 MB，请拆分文件。');
      const text = await f.text();
      let importedLibrary: Library | undefined;
      let importedReviews: Review[] = [];
      let preferences: Config | undefined;
      let words: Word[];
      if (f.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
        if (parsed.format === 'cet4-session-v1') {
          importedLibrary = validateLibrary(parsed.library);
          importedReviews = reviewSchema.array().parse(parsed.reviews);
          preferences = parsed.config ? configSchema.parse(parsed.config) : undefined;
          words = Object.values(importedLibrary.words);
        } else {
          importedLibrary = validateLibrary(parsed);
          words = Object.values(importedLibrary.words);
        }
      } else words = parseImport(text, f.name);
      setIncoming({
        words,
        filename: f.name,
        library: importedLibrary,
        reviews: importedReviews,
        config: preferences,
      });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    if (file.current) file.current.value = '';
  }
  async function importData() {
    if (!incoming) return;
    if (mode === 'demo') {
      usePortable(
        incoming.library || mergeWords(emptyLibrary(), incoming.words, 'skip'),
        incoming.reviews,
        incoming.config,
      );
      setIncoming(undefined);
      return;
    }
    const next = mergeWords(library, incoming.words, strategy);
    const ids = new Set(reviews.map((r) => r.id));
    const added = incoming.reviews.filter((r) => !ids.has(r.id));
    if (await commit(next, added, '导入成功，原词库已自动备份。', 'import')) setIncoming(undefined);
  }
  function exportArchive() {
    download(
      JSON.stringify(
        {
          format: 'cet4-session-v1',
          exported_at: new Date().toISOString(),
          library,
          reviews,
          config: store.config,
        },
        null,
        2,
      ),
      `cet4-session-${new Date().toISOString().slice(0, 10)}.json`,
    );
    setDirty(false);
  }
  const duplicateCount =
    incoming && mode !== 'demo' ? incoming.words.filter((w) => library.words[w.word]).length : 0;
  return (
    <>
      <PageTitle
        eyebrow="YOUR DATA, IN YOUR HANDS"
        title="带进来，也随时带得走。"
        description="词库属于你。导入已有积累，或把学习进度保存成随时可用的文件。"
      />
      {mode === 'portable' && (
        <div className="info-banner">
          <Info size={19} />
          <span>
            当前是手动模式，数据保留在本次会话中。离开前请下载<strong>完整学习存档</strong>
            ，下次重新导入即可继续。
          </span>
          <button className="button small primary" onClick={exportArchive}>
            保存存档
          </button>
        </div>
      )}
      <div className="two-columns">
        <section className="panel import-panel">
          <div className="section-head">
            <div>
              <h3>
                <Upload size={18} /> 导入词库
              </h3>
              <p>支持 JSON、CSV、TXT 和完整学习存档</p>
            </div>
          </div>
          <input
            ref={file}
            type="file"
            accept=".json,.csv,.txt"
            hidden
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
          <button
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            onClick={() => file.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void readFile(e.dataTransfer.files[0]);
            }}
          >
            <span className="upload-icon">
              <Upload size={28} strokeWidth={1.5} />
            </span>
            <strong>点击选择，或把文件拖到这里</strong>
            <span>JSON / CSV / TXT · 最大 30 MB</span>
            <span className="button secondary small">选择文件</span>
          </button>
          <div className="format-note">
            <h4>从一份简单的词表开始</h4>
            <pre>
              word,meaning{`\n`}maintain,保持{`\n`}significant,显著的
            </pre>
            <button
              className="text-button"
              onClick={() =>
                download(
                  'word,meaning\nmaintain,保持\nsignificant,显著的\n',
                  'import-example.csv',
                  'text/csv',
                )
              }
            >
              下载 CSV 示例 <Download size={14} />
            </button>
          </div>
        </section>
        <section className="panel export-panel">
          <div className="section-head">
            <div>
              <h3>
                <Download size={18} /> 导出你的积累
              </h3>
              <p>
                当前词库 {Object.keys(library.words).length} 个词 · {reviews.length} 条复习记录
              </p>
            </div>
          </div>
          {[
            {
              icon: Archive,
              title: '完整学习存档',
              text: '词库 + 历史 + 设置快照，适合手动模式续学',
              fn: exportArchive,
            },
            {
              icon: FileJson,
              title: 'words.json',
              text: '标准 Schema v1，与本地 Skill 共享',
              fn: () => download(JSON.stringify(library, null, 2), 'words.json'),
            },
            {
              icon: FileSpreadsheet,
              title: 'CSV 词表',
              text: '在 Excel 中浏览，便于整理和分享',
              fn: () => download(exportCSV(Object.values(library.words)), 'words.csv', 'text/csv'),
            },
            {
              icon: FileText,
              title: 'Markdown 学习笔记',
              text: '词义、易混对象、错误答案与个人笔记',
              fn: () =>
                download(
                  exportMarkdown(Object.values(library.words)),
                  'vocabulary.md',
                  'text/markdown',
                ),
            },
          ].map((item) => (
            <button key={item.title} className="export-option" onClick={item.fn}>
              <span>
                <item.icon size={23} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </div>
              <Download size={17} />
            </button>
          ))}
        </section>
      </div>
      <section className="panel starter-panel">
        <div className="starter-icon">
          <FolderOpen size={30} />
        </div>
        <div>
          <h3>还没有自己的词库？</h3>
          <p>从 48 个基础练习词开始。包含常见易混关系，不含任何演示成绩。</p>
        </div>
        <button
          className="button secondary"
          onClick={() => download(JSON.stringify(starterLibrary(), null, 2), 'words-starter.json')}
        >
          下载初始词库 <ArrowRight size={16} />
        </button>
      </section>
      {incoming && (
        <Modal title="确认导入" onClose={() => setIncoming(undefined)} wide>
          <div className="modal-body">
            <div className="import-summary">
              <FileJson size={26} />
              <div>
                <strong>{incoming.filename}</strong>
                <p>
                  {incoming.words.length} 个单词 · {duplicateCount} 个与当前词库重复 ·{' '}
                  {incoming.reviews.length} 条历史
                </p>
              </div>
            </div>
            {mode === 'demo' ? (
              <div className="info-banner">
                <Info size={17} />
                <span>导入后进入手动模式，以此文件作为你的词库。演示内容不会混入。</span>
              </div>
            ) : (
              <label className="field">
                遇到已有单词时
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as typeof strategy)}
                >
                  <option value="merge">合并释义与标签，保留已有学习成绩</option>
                  <option value="skip">跳过重复词，保留已有条目</option>
                  <option value="overwrite">覆盖整个条目，使用导入文件中的成绩</option>
                </select>
              </label>
            )}
            {strategy === 'overwrite' && mode !== 'demo' && (
              <p className="form-error">
                覆盖会替换重复词的成绩和复习安排。CSV/TXT 中的词将重置为新词。
              </p>
            )}
            <div className="import-preview">
              <table className="word-table">
                <thead>
                  <tr>
                    <th>单词</th>
                    <th>核心词义</th>
                    <th>处理</th>
                  </tr>
                </thead>
                <tbody>
                  {incoming.words.slice(0, 8).map((w) => (
                    <tr key={w.word}>
                      <td>
                        <strong>{w.word}</strong>
                      </td>
                      <td>{w.core_meaning}</td>
                      <td>
                        {mode === 'demo' || !library.words[w.word]
                          ? '新增'
                          : strategy === 'skip'
                            ? '跳过'
                            : strategy === 'merge'
                              ? '合并'
                              : '覆盖'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {incoming.words.length > 8 && (
                <p className="muted">预览前 8 个词，共 {incoming.words.length} 个。</p>
              )}
            </div>
            <div className="dialog-actions">
              <button className="button secondary" onClick={() => setIncoming(undefined)}>
                取消
              </button>
              <button className="button primary" disabled={busy} onClick={() => void importData()}>
                <Check size={16} />
                {mode === 'demo' ? '载入为我的词库' : '确认导入'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
