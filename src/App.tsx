import { useEffect, useState } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  Target,
  Shuffle,
  Flame,
  BarChart3,
  History,
  ArrowDownUp,
  Settings as SettingsIcon,
  FolderOpen,
  RefreshCw,
  ArrowRight,
  X,
  Menu,
  ShieldCheck,
  ExternalLink,
  Sprout,
  Info,
} from 'lucide-react';
import { useVocabulary } from './context';
import { localDay, type Word } from './models';
import { Modal } from './components/UI';
import { supportsDirectory } from './services/fileSystem';
import { Dashboard } from './pages/Dashboard';
import { Words, WordEditor } from './pages/Words';
import { ReviewPage } from './pages/Review';
import { Confusions, Mistakes } from './pages/Collections';
import { Analytics, HistoryPage } from './pages/Analytics';
import { Transfer } from './pages/Transfer';
import { Settings } from './pages/Settings';
import { registerSW } from 'virtual:pwa-register';

const navigation = [
  { id: 'dashboard', label: '学习概览', icon: LayoutDashboard },
  { id: 'words', label: '我的词库', icon: BookOpen },
  { id: 'review', label: '今日复习', icon: Target },
  { id: 'confusions', label: '易混词', icon: Shuffle },
  { id: 'mistakes', label: '错词本', icon: Flame },
  { id: 'analytics', label: '学习统计', icon: BarChart3 },
  { id: 'history', label: '复习记录', icon: History },
  { id: 'transfer', label: '导入导出', icon: ArrowDownUp },
  { id: 'settings', label: '设置', icon: SettingsIcon },
];
function currentPage() {
  const hash = window.location.hash.replace('#/', '');
  return navigation.some((n) => n.id === hash) ? hash : 'dashboard';
}
export default function App() {
  const s = useVocabulary();
  const [page, setPage] = useState(currentPage);
  const [sidebar, setSidebar] = useState(false);
  const [connect, setConnect] = useState(false);
  const [editor, setEditor] = useState<{ word: Word | null } | null>(null);
  const [reviewMode, setReviewMode] = useState<'daily' | 'mistakes' | 'confusions'>('daily');
  const [session, setSession] = useState(0);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);
  useEffect(() => {
    const fn = () => {
      setPage(currentPage());
      setSidebar(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setUpdate(() => () => updateSW(true));
      },
      onRegisterError(error) {
        console.warn('离线缓存注册失败', error);
      },
    });
  }, []);
  function navigate(next: string) {
    if (next === 'review') {
      setReviewMode('daily');
      setSession((n) => n + 1);
    }
    window.location.hash = '/' + next;
    setPage(next);
    setSidebar(false);
    window.scrollTo(0, 0);
  }
  function startReview(mode: 'daily' | 'mistakes' | 'confusions' = 'daily') {
    setReviewMode(mode);
    setSession((n) => n + 1);
    window.location.hash = '/review';
    setPage('review');
    window.scrollTo(0, 0);
  }
  const editWord = (word: Word) => setEditor({ word });
  const due = Object.values(s.library.words).filter(
    (w) => w.status !== 'suspended' && w.schedule.due_at <= localDay(),
  ).length;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      {sidebar && <div className="sidebar-scrim" onClick={() => setSidebar(false)} />}
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <a href="#/dashboard" className="brand" onClick={() => setSidebar(false)}>
          <span className="brand-icon">
            <BookOpen size={25} strokeWidth={1.7} />
          </span>
          <span>
            <strong>
              拾词<span className="brand-dot">.</span>
            </strong>
            <small>CET-4 VOCABULARY</small>
          </span>
        </a>
        <div className="sidebar-label">每天，拾起一点进步</div>
        <nav aria-label="主导航">
          {navigation.map((item, i) => (
            <div key={item.id} className={i === 7 ? 'nav-separator' : ''}>
              <button
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
              >
                <item.icon size={19} strokeWidth={1.7} />
                <span>{item.label}</span>
                {item.id === 'review' && due > 0 && <span className="nav-count">{due}</span>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sprout size={22} />
            <p>
              不急着记住所有词，
              <br />
              只让今天比昨天更清晰。
            </p>
            <span>ONE WORD AT A TIME</span>
          </div>
          <button className="sidebar-connection" onClick={() => setConnect(true)}>
            <span className={`connection-light ${s.mode === 'folder' ? 'green' : ''}`} />
            <span>
              <strong>
                {s.mode === 'folder'
                  ? '本地词库已连接'
                  : s.mode === 'demo'
                    ? '正在体验演示词库'
                    : '手动文件模式'}
              </strong>
              <small>{s.mode === 'folder' ? s.directory : '连接目录，保存你的进步'}</small>
            </span>
            <FolderOpen size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              aria-label="打开导航"
              onClick={() => setSidebar(true)}
            >
              <Menu size={21} />
            </button>
            <span>我的学习空间</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{navigation.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            {s.mode === 'folder' ? (
              <>
                <span className="connection-tag connected">
                  <i />
                  本地已连接
                </span>
                <button
                  className="icon-button"
                  title="重新加载本地数据"
                  aria-label="重新加载本地数据"
                  disabled={s.busy}
                  onClick={() => void s.reload()}
                >
                  <RefreshCw size={16} />
                </button>
              </>
            ) : (
              <button className="top-connect" onClick={() => setConnect(true)}>
                <FolderOpen size={16} />
                <span>连接数据目录</span>
              </button>
            )}
            <span className="topbar-divider" />
            <div className="avatar" title="本地学习空间">
              <span>词</span>
              <i />
            </div>
          </div>
        </header>
        <main id="main-content">
          <div className="content-wrap">
            {s.mode !== 'folder' && (
              <div className="mode-banner">
                <span>
                  <span className="mode-dot" />
                  {s.mode === 'demo' ? '演示空间' : '手动模式'}
                </span>
                <p>
                  {s.mode === 'demo'
                    ? '当前展示示例词库和模拟成绩。连接本地目录，开始记录你的真实进步。'
                    : '更改只保留在本次会话中。离开前请导出完整学习存档。'}
                </p>
                <button
                  className="text-button"
                  onClick={() => (s.mode === 'demo' ? setConnect(true) : navigate('transfer'))}
                >
                  {s.mode === 'demo' ? '开始使用' : '导出存档'}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            {s.error && (
              <div className="error-banner" role="alert">
                <Info size={19} />
                <div>
                  <strong>操作未完成</strong>
                  <p>{s.error}</p>
                </div>
                {s.mode === 'folder' && (
                  <button
                    className="button small secondary"
                    disabled={s.busy}
                    onClick={() => void s.reload()}
                  >
                    重新加载
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label="关闭错误提示"
                  onClick={() => s.setError('')}
                >
                  <X size={17} />
                </button>
              </div>
            )}
            {page === 'dashboard' && (
              <Dashboard navigate={navigate} startReview={startReview} editWord={editWord} />
            )}
            {page === 'words' && (
              <Words editWord={editWord} addWord={() => setEditor({ word: null })} />
            )}
            {page === 'review' && (
              <ReviewPage
                key={`${session}-${s.mode}-${s.directory}`}
                mode={reviewMode}
                navigate={navigate}
              />
            )}
            {page === 'confusions' && (
              <Confusions startReview={() => startReview('confusions')} editWord={editWord} />
            )}
            {page === 'mistakes' && (
              <Mistakes startReview={() => startReview('mistakes')} editWord={editWord} />
            )}
            {page === 'analytics' && <Analytics editWord={editWord} />}
            {page === 'history' && <HistoryPage />}
            {page === 'transfer' && <Transfer />}
            {page === 'settings' && <Settings openConnect={() => setConnect(true)} />}
            <footer className="footer">
              <span>
                <ShieldCheck size={14} />
                数据留在本地，进步属于自己。
              </span>
              <a href="https://github.com/Alitaliy/cet4-web" target="_blank" rel="noreferrer">
                拾词 v0.2 <ExternalLink size={12} />
              </a>
            </footer>
          </div>
        </main>
      </div>
      {s.notice && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          {s.notice}
        </div>
      )}
      {s.busy && (
        <div className="saving-indicator" role="status">
          <span />
          正在处理…
        </div>
      )}
      {update && (
        <div className="update-banner">
          <span>有新版本可用，请先完成当前复习并保存数据。</span>
          <button
            className="button small primary"
            onClick={() => {
              if (s.mode === 'portable' && s.dirty) {
                s.setError('请先导出完整学习存档，再更新网页。');
                return;
              }
              void update();
            }}
          >
            更新网页
          </button>
          <button className="icon-button" aria-label="稍后更新" onClick={() => setUpdate(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {connect && (
        <Modal title="连接你的学习空间" onClose={() => setConnect(false)}>
          <div className="modal-body">
            <div className="connect-illustration">
              <FolderOpen size={43} strokeWidth={1.3} />
              <Sprout size={23} />
            </div>
            <h3 className="connect-title">一份词库，延续每一次学习。</h3>
            <p>
              选择本地的 <strong>CET4-Vocab</strong> 文件夹。网页与 Skill
              都会读写其中的词库和复习记录。
            </p>
            <div className="directory-example">Documents / CET4-Vocab / data / words.json</div>
            <p className="hint">
              空目录会自动初始化 48 个基础练习词，成绩从零开始。已有目录会先校验，绝不重复初始化。
            </p>
            {supportsDirectory() ? (
              <>
                <button
                  className="button primary full-width"
                  disabled={s.busy}
                  onClick={async () => {
                    if (await s.connect()) setConnect(false);
                  }}
                >
                  <FolderOpen size={17} />
                  选择数据目录
                </button>
                {s.recent && (
                  <button
                    className="button secondary full-width"
                    disabled={s.busy}
                    onClick={async () => {
                      if (await s.connect(true)) setConnect(false);
                    }}
                  >
                    重新连接 {s.recent.name}
                  </button>
                )}
              </>
            ) : (
              <div className="info-banner">
                <Info size={18} />
                <span>请使用桌面 Chrome / Edge 连接目录，或通过下方的手动导入使用本应用。</span>
              </div>
            )}
            {s.error && (
              <p className="form-error" role="alert">
                {s.error}
              </p>
            )}
            <button
              className="text-button connect-fallback"
              onClick={() => {
                setConnect(false);
                navigate('transfer');
              }}
            >
              使用手动导入 / 导出 <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
      {editor && <WordEditor word={editor.word} onClose={() => setEditor(null)} />}
    </div>
  );
}
