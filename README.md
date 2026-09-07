# 拾词 · CET-4 Vocabulary

本地优先的四级词汇学习工具：静态网页管理和复习，Codex Skill 负责自然语言测试与纠错，双方共享同一份 `data/words.json`。

**在线使用：[alitaliy.github.io/cet4-web](https://alitaliy.github.io/cet4-web/)**

**源码：[Alitaliy/cet4-web](https://github.com/Alitaliy/cet4-web)**

## 开始使用

1. 用桌面 **Chrome 或 Edge** 打开在线网页。
2. 点击右上角「连接数据目录」，选择或新建 `Documents/CET4-Vocab` 文件夹。
3. 空目录会自动创建 48 个基础练习词，学习成绩从零开始。已有 v1 词库会校验并加载。
4. 在「我的词库」添加词汇，或在「导入导出」上传 CSV、TXT、JSON。
5. 点击「开始今日复习」，输入意思，查看答案后选择正确 / 模糊 / 错误 / 不会。目录模式会即时保存每道已评分的题。

首次打开展示的是**演示词库与模拟成绩**，仅用于体验，不会混入新建的个人词库。演示不是用户真实学习历史，也不是完整的四级词典。

Safari、Firefox 和多数移动浏览器可使用手动模式：导入词库 → 学习 → 下载「完整学习存档」→ 下次重新导入。手动数据仅在当前会话中；请等下载完成、确认文件存在后关闭网页。仅导出 words.json 不含复习历史，完整存档才包含历史及设置快照。

## 已实现的功能

- 学习概览：待复习、学习中、掌握数、连续学习日、每日目标、正确率趋势和 14 周学习日历。
- 词库：中英文搜索、状态/标签/到期/易混筛选、排序、分页、新增和编辑、批量修改与删除。
- 单词详情：核心词义、音标、词性、易混关系、同义词、搭配、备注、错误答案、历史与反应时间。
- 每日复习与专项练习：英译中主动回想、四档自评、间隔调度、慢速提取处理、错词本轮再现一次。
- 易混对比、错词排行、7/14/30 天统计、历史搜索与来源筛选。
- CSV/TXT/Schema v1 JSON 导入预览：跳过 / 合并 / 覆盖。合并保留现有学习成绩；覆盖会使用导入条目的成绩。
- JSON、CSV、Markdown、历史 JSONL、完整学习存档导出。
- 本地目录授权、IndexedDB 记忆目录句柄、Schema 校验、revision/content 冲突阻止、每次写入前备份、备份恢复、未完成事务恢复。
- 可下载的 Codex Skill 与无第三方依赖的 Python CLI。
- PWA 应用图标和离线静态资源缓存；新版本提示更新。
- GitHub Actions 自动检查、构建、发布到 GitHub Pages。

这是可运行的 **v0.2**，已覆盖设计中的主要学习闭环，尚不把后续路线全部视为完成。没有在线账户、后端服务或付费 AI API；网页评分由本人确认，复杂语义判分由 Codex 完成。

## 数据目录

```text
CET4-Vocab/
├── data/
│   ├── meta.json
│   ├── config.json
│   ├── words.json                 # 唯一主词库
│   ├── reviews/YYYY-MM.jsonl      # 逐次复习事件
│   └── pending.json              # 仅在跨文件保存尚未完成时存在
├── backups/words_*.json
├── exports/
└── logs/
```

网页不会上传所选目录中的词库或学习记录。应用字体和静态资源与网页一起托管、缓存。IndexedDB 只保存目录句柄，不另建一份主词库。GitHub 仓库不包含个人数据目录，`.gitignore` 已排除常见数据路径。

网页初始化按实际写入需要创建子目录；CLI `init` 会创建完整目录结构。使用浏览器 SpeechSynthesis 发音，是否提供本地语音由系统决定；离线环境下以本机可用语音为准。

## Skill 联动

网页「设置」可以下载完整 Skill ZIP。将其解压到：

```text
~/.codex/skills/cet4-vocab-coach/SKILL.md
```

Windows 从本仓库安装也可以运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-skill.ps1
```

安装脚本不覆盖已有 Skill。开启新的 Codex 对话后说：

> 用 cet4-vocab-coach 继续四级单词训练。

Skill 默认与网页选定的 `~/Documents/CET4-Vocab` 共用数据。自定义目录通过 `CET4_VOCAB_HOME` 环境变量或命令全局参数 `--home` 指定：

```powershell
python skills/cet4-vocab-coach/scripts/vocab.py --home D:\Study\CET4-Vocab init
python skills/cet4-vocab-coach/scripts/vocab.py --home D:\Study\CET4-Vocab due --limit 30 --json
```

也可以直接运行 CLI：

```text
python skills/cet4-vocab-coach/scripts/vocab.py init
python skills/cet4-vocab-coach/scripts/vocab.py due --limit 30 --json
python skills/cet4-vocab-coach/scripts/vocab.py record-batch results.json
python skills/cet4-vocab-coach/scripts/vocab.py show consequence --json
python skills/cet4-vocab-coach/scripts/vocab.py stats --json
python skills/cet4-vocab-coach/scripts/vocab.py export --format session
python skills/cet4-vocab-coach/scripts/vocab.py validate
```

Skill 写完后在网页点击「重新加载」；网页写完后 Skill 再读取。无需提交学习记录到 GitHub。详细协议和批量结果格式见 [Skill](skills/cet4-vocab-coach/SKILL.md) 与 [数据协议](skills/cet4-vocab-coach/references/DATA_SCHEMA.md)。

## 保存、备份与边界

- 每次保存比较 revision **及完整内容**，有外部改动就拒绝覆盖。必须重新加载后再编辑。
- 自动备份默认保留最近 30 份，可在设置中调整。恢复前再次备份当前词库，恢复后 revision 继续递增。
- 恢复词库快照不删除历史，因此恢复后的词条统计与累计事件统计可能不同。完整迁移需复制整个数据目录。
- 保存先写待完成事务，再写词库与历史；中断后下次加载幂等补齐。同一 review ID 不重复写入。
- 同源网页标签页由 Web Locks 串行化；CLI 进程使用本地排他锁。**网页与 Python 之间的乐观检查仍有极短的竞争窗口**，不要让两端在同一瞬间保存，也不要让两台设备同时修改云同步目录。当前版本不宣称跨进程完全原子互斥。
- 崩溃残留 CLI 锁时先确认 `.codex-write.lock` 中 PID 对应的进程已停止，再移除锁。损坏 JSON 或事务冲突会停止操作并保留文件，不能直接清空后声称已恢复。
- 原目录未提供旧 Skill ZIP / starter_words.json。当前项目没有虚构旧成绩；仅支持文档明确列出的旧格式迁移，未知格式需先检查。
- 初次使用需联网下载静态资源并等待离线缓存完成。离线启动仍需浏览器允许访问目录；手机需手动模式。更新网页前先结束当前复习并下载手动模式存档。
- 合并导入完整存档时合并词库与历史，不自动覆盖当前学习偏好；从演示切换到手动模式时可恢复存档偏好。

## 本地开发

Node.js 22.12+、Python 3.10+。Python CLI 无额外依赖。开发使用 React / TypeScript / Vite，界面用 CSS 与 SVG 图表，避免引入不必要的后端。

```text
npm ci
npm run dev
npm test
npm run test:skill
npm run build
npm run preview
```

浏览器验证：构建后执行 `npm run test:e2e`。Windows 默认使用已安装的 Edge，Linux 首次需 `npx playwright install --with-deps chromium`。测试覆盖导航、手机布局、词库编辑、复习、原生浏览器文件读写与冲突、存档往返以及离线启动。

也可双击 `start.bat` 启动开发预览。默认子路径 `/cet4-web/`，预览地址 `http://127.0.0.1:4173/cet4-web/`。默认 build 自动把 Skill 打包到发布目录。重新绘制应用图标的维护脚本 `scripts/create_icons.py` 需要 Pillow，正常构建使用已提交的图标，无需 Pillow。

## GitHub Pages

推送到 `main` 后自动执行 TypeScript/数据层测试、Python 测试、浏览器验证、构建并发布 `dist/`。Pull request 只检查，不发布。仓库 Pages 发布源设为 **GitHub Actions**。

使用 hash 路由，所以直接打开 `/#/words` 和刷新子页面不需要后端重写。工作流按仓库名设置 Vite base；仓库更名时还需同步 README 和应用中的 GitHub 链接。用户主站 `username.github.io` 部署时应把 `VITE_BASE_PATH` 改为 `/`。

部署依据：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite 静态部署](https://vite.dev/guide/static-deploy.html)。

## 原始方案

- [网页实现方案](CET4-Vocab-Web-Implementation-Plan.md)
- [Skill 设计方案](CET4-Vocab-Skill-Design-Plan.md)

原设计保留作为需求背景；本 README 描述当前实际实现和已知限制。
