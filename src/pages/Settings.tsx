import { useEffect, useState } from 'react';
import {
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  Download,
  Link2,
  HardDrive,
  Archive,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { useVocabulary } from '../context';
import { supportsDirectory, withDirectoryLock } from '../services/fileSystem';
import { PageTitle, Modal, Empty } from '../components/UI';
import { type Config } from '../models';

export function Settings({ openConnect }: { openConnect: () => void }) {
  const s = useVocabulary();
  const [draft, setDraft] = useState<Config>(s.config);
  const [backups, setBackups] = useState<string[]>([]);
  const [restore, setRestore] = useState('');
  useEffect(() => setDraft(s.config), [s.config]);
  useEffect(() => {
    if (s.repo.current)
      void s.repo.current
        .listBackups()
        .then(setBackups)
        .catch((e) => s.setError(String(e)));
    else setBackups([]);
  }, [s.library, s.mode]);
  async function makeBackup() {
    await s.run(async () => {
      if (!s.repo.current) return;
      await withDirectoryLock(() => s.repo.current!.backup());
      setBackups(await s.repo.current.listBackups());
      s.setNotice('已创建词库快照。');
    });
  }
  async function restoreBackup() {
    const ok = await s.run(async () => {
      if (!s.repo.current) return;
      await withDirectoryLock(() => s.repo.current!.restore(s.library, restore));
    });
    if (ok) {
      setRestore('');
      await s.reload();
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="MAKE IT YOURS"
        title="按自己的节奏，慢慢来。"
        description="连接你的数据目录，调整学习目标，让每一次复习都更适合自己。"
      />
      <section className="panel settings-section">
        <div className="section-head">
          <div>
            <h3>
              <HardDrive size={19} /> 本地数据目录
            </h3>
            <p>网页和 Codex Skill 通过同一份本地文件延续学习进度</p>
          </div>
          <span className={`connection-tag ${s.mode === 'folder' ? 'connected' : ''}`}>
            <i />
            {s.mode === 'folder' ? '已连接' : s.mode === 'demo' ? '演示模式' : '手动模式'}
          </span>
        </div>
        <div className="directory-display">
          <FolderOpen size={28} />
          <div>
            <strong>{s.directory || '尚未连接本地目录'}</strong>
            <span>
              {s.mode === 'folder'
                ? `data/words.json · revision ${s.library.revision} · 最后来源 ${s.library.updated_by}`
                : '建议目录：Documents / CET4-Vocab'}
            </span>
          </div>
          <button className="button primary" disabled={s.busy} onClick={openConnect}>
            {s.mode === 'folder' ? '更换目录' : '连接数据目录'}
          </button>
        </div>
        <p className="hint">
          {supportsDirectory()
            ? '当前浏览器支持直接读写目录。空目录会自动创建基础词库；已有词库通过校验后原样加载。'
            : '当前浏览器不支持目录读写，请使用桌面 Chrome / Edge，或使用“导入导出”的手动模式。'}
        </p>
        {s.mode === 'folder' && (
          <div className="button-row">
            <button
              className="button secondary small"
              disabled={s.busy}
              onClick={() => void s.reload()}
            >
              <RefreshCw size={14} />
              重新加载
            </button>
            <button className="text-button" disabled={s.busy} onClick={() => void s.disconnect()}>
              断开目录
            </button>
          </div>
        )}
      </section>
      <div className="two-columns">
        <section className="panel settings-section">
          <div className="section-head">
            <h3>学习偏好</h3>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void s.saveConfig(draft);
            }}
          >
            <label className="setting-field">
              <span>
                <strong>每日目标</strong>
                <small>每天计划复习的不同单词数</small>
              </span>
              <div>
                <input
                  aria-label="每日目标"
                  type="number"
                  min={5}
                  max={100}
                  required
                  value={draft.daily_limit}
                  onChange={(e) => setDraft({ ...draft, daily_limit: Number(e.target.value) })}
                />
                <span>词</span>
              </div>
            </label>
            <label className="setting-field">
              <span>
                <strong>反应时间参考线</strong>
                <small>超过此时间的正确答案会缩短复习间隔</small>
              </span>
              <div>
                <input
                  aria-label="反应时间参考线"
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={draft.slow_response_ms / 1000}
                  onChange={(e) =>
                    setDraft({ ...draft, slow_response_ms: Number(e.target.value) * 1000 })
                  }
                />
                <span>秒</span>
              </div>
            </label>
            <label className="setting-field">
              <span>
                <strong>自动备份保留数</strong>
                <small>自动清理较早的词库快照</small>
              </span>
              <div>
                <input
                  aria-label="自动备份保留数"
                  type="number"
                  min={5}
                  max={100}
                  required
                  value={draft.backup_limit}
                  onChange={(e) => setDraft({ ...draft, backup_limit: Number(e.target.value) })}
                />
                <span>份</span>
              </div>
            </label>
            <div className="dialog-actions">
              <button className="button primary" disabled={s.busy}>
                保存设置
              </button>
            </div>
          </form>
        </section>
        <section className="panel settings-section skill-panel">
          <div className="section-head">
            <h3>
              <Link2 size={18} /> 与 Codex 一起学习
            </h3>
          </div>
          <div className="skill-mark">✳</div>
          <h3>会延续记忆的词汇教练。</h3>
          <p>自然语言测试、中文语义判分、易混词纠错。安装配套 Skill 后，告诉 Codex：</p>
          <blockquote>“用 cet4-vocab-coach 继续四级单词训练。”</blockquote>
          <p className="hint">
            解压到 ~/.codex/skills/cet4-vocab-coach，确保 SKILL.md 直接位于该目录。Skill 默认使用
            Documents/CET4-Vocab；自定义目录时设置 CET4_VOCAB_HOME。
          </p>
          <div className="button-row">
            <a
              className="button primary small"
              href={`${import.meta.env.BASE_URL}cet4-vocab-coach.zip`}
              download
            >
              <Download size={15} />
              下载配套 Skill
            </a>
            <a
              className="text-button"
              href="https://github.com/Alitaliy/cet4-web#skill-联动"
              target="_blank"
              rel="noreferrer"
            >
              安装说明 <ExternalLink size={13} />
            </a>
          </div>
        </section>
      </div>
      <section className="panel settings-section">
        <div className="section-head">
          <div>
            <h3>
              <ShieldCheck size={18} /> 备份与恢复
            </h3>
            <p>每次词库保存前创建快照。恢复词库保留历史日志，并生成新的 revision。</p>
          </div>
          <button
            className="button secondary small"
            disabled={s.busy || s.mode !== 'folder'}
            onClick={() => void makeBackup()}
          >
            <Archive size={15} />
            立即备份
          </button>
        </div>
        {backups.length ? (
          <div className="backup-list">
            {backups.slice(0, 10).map((name) => (
              <div key={name}>
                <FileBackup name={name} />
                <button className="text-button" disabled={s.busy} onClick={() => setRestore(name)}>
                  <RotateCcw size={14} />
                  恢复
                </button>
              </div>
            ))}
            {backups.length > 10 && (
              <p className="hint">
                显示最近 10 份，全部 {backups.length} 份可在本地 backups 目录查看。
              </p>
            )}
          </div>
        ) : (
          <Empty
            title={s.mode === 'folder' ? '还没有备份' : '连接目录后，自动备份将在这里显示'}
            text="你也可以在导入导出页下载完整学习存档。"
          />
        )}
      </section>
      {restore && (
        <Modal title="恢复这份词库备份？" onClose={() => setRestore('')}>
          <div className="modal-body">
            <p className="backup-filename">{restore}</p>
            <p>
              词库内容和学习状态将恢复到这个快照。当前词库会先备份；原有复习日志继续保留，因此历史统计与恢复后的词条统计可能不同。
            </p>
            <div className="dialog-actions">
              <button className="button secondary" onClick={() => setRestore('')}>
                取消
              </button>
              <button
                className="button primary"
                disabled={s.busy}
                onClick={() => void restoreBackup()}
              >
                备份当前并恢复
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function FileBackup({ name }: { name: string }) {
  return (
    <span className="backup-name">
      <Archive size={16} />
      {name}
    </span>
  );
}
