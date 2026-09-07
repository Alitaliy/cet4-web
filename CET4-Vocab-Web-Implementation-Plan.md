# CET-4 Vocabulary Web 管理系统实现方案

> 目标：构建一套 **纯静态网页 + 本地文件存储 + Codex Skill 共用同一份数据** 的四级词汇学习系统。
>
> 核心原则：**聊天上下文不是长期记忆，`words.json` 才是长期记忆。**

---

## 1. 项目目标

本项目用于解决以下问题：

1. ChatGPT / Codex 对话上下文过长后可能丢失早期词汇学习状态。
2. 传统单词本只能记录“认识 / 不认识”，难以记录：
   - 模糊词
   - 易混词
   - 错误映射
   - 历史错误答案
   - 连续正确次数
   - 下次复习时间
   - 反应速度
3. 希望既能通过网页方便地管理词库，又能让 Codex Skill 自动读取相同数据进行测试、分析和写回。
4. 不希望搭建后端服务器、数据库或额外付费 API。

最终实现：

```text
静态 Web 管理页面
        │
        │ File System Access API
        ▼
本地 CET4-Vocab 数据目录
        ▲
        │ Python / Codex Skill
        │
CET4 Vocabulary Coach Skill
```

网页与 Skill **共享同一份本地数据**。

---

# 2. 总体架构

```text
┌─────────────────────────────────────────────┐
│              CET-4 Vocabulary               │
│                                             │
│         React + TypeScript 静态网页          │
│                                             │
│  Dashboard / 单词库 / 复习 / 错词 / 易混词 │
│  历史记录 / 统计 / 导入导出 / 设置           │
└──────────────────┬──────────────────────────┘
                   │
                   │ File System Access API
                   │
                   ▼
C:\Users\<User>\Documents\CET4-Vocab\
│
├─ data\
│  ├─ meta.json
│  ├─ config.json
│  ├─ words.json
│  └─ reviews\
│     ├─ 2026-09.jsonl
│     ├─ 2026-10.jsonl
│     └─ ...
│
├─ backups\
│  ├─ words_2026-09-07_165830.json
│  └─ ...
│
├─ exports\
│  ├─ words.csv
│  ├─ mistakes.md
│  └─ summary.md
│
└─ logs\

                   ▲
                   │
                   │ 直接读取 / 写入 JSON
                   │
┌──────────────────┴──────────────────────────┐
│          CET4 Vocabulary Coach Skill        │
│                                             │
│  出题 / 纠错 / 错因分析 / 易混检测 / 调度   │
│  更新词库 / 写历史记录 / 生成学习建议        │
└─────────────────────────────────────────────┘
```

---

# 3. 技术选型

推荐：

```text
React
TypeScript
Vite
Tailwind CSS
Recharts
IndexedDB
File System Access API
PWA / Service Worker（后期）
```

## 3.1 React

适合管理后台、复杂状态和多页面交互。

## 3.2 TypeScript

整个系统的数据结构较复杂，例如：

- Word
- Review
- Schedule
- Confusion
- Statistics
- Config

使用 TypeScript 可以显著降低字段拼写错误、类型不一致和数据迁移问题。

## 3.3 Vite

用于开发与构建。

开发：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

生成：

```text
dist/
```

最终全部是静态 HTML / CSS / JS，不需要后端。

## 3.4 Tailwind CSS

用于快速构建简洁现代的管理界面。

## 3.5 Recharts

用于：

- 正确率折线图
- 学习量统计
- 状态分布图
- 反应时间趋势

## 3.6 IndexedDB

**只保存浏览器侧辅助数据，不保存主词库。**

主要用于：

- 最近授权的数据目录句柄
- 页面 UI 设置
- 本地缓存
- 最近筛选条件

主数据始终保存到真实本地文件中。

---

# 4. 本地文件读写方案

浏览器使用 File System Access API。

第一次进入网站时，用户点击：

```text
选择 CET4 数据目录
```

网页调用：

```ts
const dirHandle = await window.showDirectoryPicker({
  mode: "readwrite"
});
```

用户选择：

```text
C:\Users\xxx\Documents\CET4-Vocab
```

网页获得授权后即可读取：

```text
data/words.json
```

以及写入：

```text
data/reviews/*.jsonl
backups/*
exports/*
```

---

# 5. 推荐部署方式

不建议直接双击：

```text
index.html
```

建议通过本地静态服务器运行：

```text
http://localhost:4173
```

例如提供：

```text
start.bat
```

双击后自动：

```text
启动静态服务器
↓
打开浏览器
↓
http://localhost:4173
```

后续可以进一步做成 PWA，使其表现更接近桌面应用。

---

# 6. 数据设计原则

最重要的设计：

> **网页与 Skill 必须遵守统一的数据协议。**

定义：

```text
CET4 Data Schema v1
```

网页不能自定义另一套词库格式，Skill 也不能维护自己的独立状态。

---

# 7. words.json 数据结构

推荐结构：

```json
{
  "schema_version": 1,
  "revision": 53,
  "updated_at": "2026-09-07T16:50:00+08:00",
  "updated_by": "web",
  "words": {
    "consequence": {
      "word": "consequence",
      "phonetic": "",
      "core_meaning": "后果；结果",
      "meanings": [
        {
          "pos": "n.",
          "zh": "后果；结果",
          "primary": true
        }
      ],
      "status": "confusing",
      "tags": [
        "CET4",
        "high-frequency"
      ],
      "confused_with": [
        "conclusion"
      ],
      "wrong_answers": {
        "结论": 2
      },
      "synonyms": [
        "result",
        "outcome"
      ],
      "antonyms": [],
      "word_family": [],
      "collocations": [
        "as a consequence"
      ],
      "stats": {
        "seen": 5,
        "correct": 2,
        "wrong": 3,
        "fuzzy": 0,
        "streak": 0,
        "lapses": 2,
        "avg_response_ms": 4820
      },
      "schedule": {
        "stage": 1,
        "interval_days": 0,
        "due_at": "2026-09-07"
      },
      "last_review": {
        "result": "wrong",
        "answer": "结论",
        "response_ms": 4100,
        "at": "2026-09-07T16:30:00+08:00"
      },
      "created_at": "2026-09-07T15:50:00+08:00",
      "updated_at": "2026-09-07T16:30:00+08:00",
      "notes": ""
    }
  }
}
```

---

# 8. Word 状态设计

建议状态：

```text
new
learning
fuzzy
confusing
mastered
suspended
```

含义：

| 状态 | 含义 |
|---|---|
| new | 新加入，尚未正式测试 |
| learning | 正在学习 |
| fuzzy | 意思模糊，能猜到但不能快速确认 |
| confusing | 容易和其他单词混淆 |
| mastered | 已较稳定掌握 |
| suspended | 暂停复习 |

---

# 9. 复习历史设计

不要把所有历史全部塞进 `words.json`。

使用：

```text
data/reviews/YYYY-MM.jsonl
```

例如：

```text
data/reviews/2026-09.jsonl
```

每次复习追加一行：

```json
{"id":"r001","word":"affect","time":"2026-09-07T16:20:32+08:00","result":"wrong","answer":"效果","response_ms":3800,"source":"web"}
{"id":"r002","word":"reveal","time":"2026-09-07T16:21:04+08:00","result":"correct","answer":"揭示","response_ms":1200,"source":"web"}
{"id":"r003","word":"consequence","time":"2026-09-07T16:21:31+08:00","result":"wrong","answer":"结论","response_ms":5100,"source":"codex"}
```

`source` 推荐：

```text
web
codex
import
manual
```

---

# 10. revision 并发控制

网页和 Codex 都可能修改 `words.json`。

因此必须存在：

```json
"revision": 53
```

保存流程：

```text
网页当前 revision = 53
↓
保存前重新读取磁盘
↓
磁盘 revision = 53
↓
允许保存
↓
revision = 54
```

如果：

```text
网页缓存 revision = 53
磁盘 revision = 54
```

说明：

```text
Codex 或其他程序已经修改词库
```

网页必须阻止覆盖，并提示：

```text
检测到外部修改。
请重新加载最新数据后再保存。
```

这种方式属于简单的乐观并发控制。

---

# 11. 自动备份机制

所有重要写入前建议备份。

目录：

```text
backups/
```

文件名：

```text
words_2026-09-07_165830.json
```

推荐策略：

```text
普通单词复习：无需每题备份
批量编辑：备份
导入数据：备份
批量删除：备份
Schema Migration：强制备份
```

默认保留最近：

```text
30 份
```

可以在设置页修改。

---

# 12. 页面结构

推荐左侧导航：

```text
首页
单词库
今日复习
易混词
错词本
学习统计
历史记录
导入导出
设置
```

---

# 13. Dashboard 首页

示例：

```text
┌─────────────────────────────────────────────────┐
│ CET-4 Vocabulary                      数据已连接 │
├─────────────────────────────────────────────────┤
│                                                 │
│ 今日待复习       学习中         已掌握           │
│     32             148            327            │
│                                                 │
│ 顽固易混词       今日正确率      连续学习          │
│     18             76%             7 天           │
│                                                 │
├─────────────────────────────────────────────────┤
│           最近 14 天正确率折线图                 │
├─────────────────────────────────────────────────┤
│ 今日重点                                         │
│                                                 │
│ consequence ↔ conclusion                       │
│ affect ↔ effect                                │
│ previous ↔ preview                             │
│ particular ↔ participate                       │
│                                                 │
│               [开始今日复习]                    │
└─────────────────────────────────────────────────┘
```

首页核心指标：

- 今日待复习数
- 总词数
- 学习中
- 模糊词
- 易混词
- 已掌握
- 今日正确率
- 最近 7 / 14 / 30 天正确率
- 连续学习天数
- 顽固词 Top 10

---

# 14. 单词库页面

表格字段：

| Word | 核心词义 | 状态 | 正确率 | 连对 | 错误 | 下次复习 | 易混 |
|---|---|---|---:|---:|---:|---|---|
| affect | 影响 | 易混 | 33% | 0 | 4 | 今天 | effect |
| acquire | 获得 | 学习中 | 80% | 3 | 1 | 3 天后 | |
| consequence | 后果 | 易混 | 25% | 0 | 5 | 今天 | conclusion |
| maintain | 保持 | 已掌握 | 100% | 5 | 0 | 30 天后 | |

支持：

- 搜索
- 排序
- 状态筛选
- 标签筛选
- 到期筛选
- 易混筛选
- 批量编辑
- 批量删除
- 新增单词
- CSV 导出

---

# 15. 搜索设计

支持英文：

```text
con
```

匹配：

```text
consequence
considerable
conclusion
concern
```

支持中文：

```text
后果
```

匹配：

```text
consequence
result
outcome
```

搜索字段：

- word
- core_meaning
- meanings
- synonyms
- confused_with
- tags
- notes

---

# 16. 单词详情页

例如：

```text
consequence

核心意思
后果；结果

状态
易混词

易混对象
conclusion → 结论

历史错误答案
结论 × 3

正确率
3 / 8 = 37.5%

平均反应时间
4.8 秒

最近表现
09/07 ❌ 结论
09/07 ❌ 结论
09/08 ✅ 后果
09/09 ✅ 后果

同义词
result
outcome

搭配
as a consequence

备注
...
```

支持直接编辑。

---

# 17. 错词本

按以下权重排序：

```text
错误次数
+ 最近错误程度
+ 连续错误次数
+ 反应过慢
```

例如：

```text
🔥 顽固词

consequence     5 次错误
 affect          4 次错误
 essential       4 次错误
 circumstance    3 次错误
 considerable    3 次错误
```

支持一键：

```text
开始顽固词专项复习
```

---

# 18. 易混词系统

这是本项目的重点功能之一。

例如：

```text
consequence
后果

VS

conclusion
结论
```

再例如：

```text
affect       → 影响
effect       → 效果

previous     → 先前的
preview      → 预览

appropriate  → 合适的
appreciate   → 感激、欣赏

eventually   → 最终
especially    → 尤其

particular    → 特定的
participate   → 参加
```

Skill 如果发现用户答：

```text
consequence = 结论
```

就可以自动记录：

```json
"confused_with": ["conclusion"]
```

网页随即显示这组易混词。

---

# 19. 每日复习页面

界面：

```text
12 / 30

        consequence

请输入核心中文意思：

[_______________________]

       提交
```

提交后显示：

```text
❌ 错误

正确：后果；结果

你的答案：结论

检测到可能与 conclusion 混淆。

consequence = 后果
conclusion  = 结论
```

---

# 20. 三档评分

建议保留：

```text
正确
模糊
错误
```

判断逻辑：

## 正确

- 核心意思正确
- 2～3 秒内快速提取效果最佳

## 模糊

例如：

```text
consequence

用户：结果？后果？
```

虽然方向正确，但提取不稳定。

## 错误

包括：

- 完全不会
- 答错
- 与其他词错误映射

---

# 21. 反应时间

网页可以自动记录：

```text
题目出现时间
提交答案时间
```

计算：

```text
response_ms
```

例如：

| Word | 正确率 | 平均反应 |
|---|---:|---:|
| maintain | 100% | 1.2s |
| acquire | 88% | 2.1s |
| considerable | 67% | 5.6s |
| consequence | 45% | 7.4s |

意义：

> “答对”不等于“真正熟练”。

如果一个词需要 8 秒才能想起来，仍应降低其掌握评级。

---

# 22. 初版复习算法

第一版不建议过度复杂。

推荐：

```text
错误
↓
当前学习轮再次出现
↓
第二天再测

模糊
↓
第二天

连续正确 1 次
↓
1 天

连续正确 2 次
↓
2 天

连续正确 3 次
↓
4 天

连续正确 4 次
↓
7 天

连续正确 5 次
↓
15 天

连续正确 6 次
↓
30 天

连续正确 7 次
↓
60 天
```

任何一次错误：

```text
streak = 0
lapses += 1
```

并降低复习间隔。

---

# 23. 每日出题策略

例如每日 40 词：

```text
60% 到期复习词
20% 顽固 / 易混词
20% 新词
```

即：

```text
24 到期词
8 易混 / 顽固词
8 新词
```

排序优先级可以综合：

```text
是否到期
错误次数
最近一次结果
易混等级
当前 streak
平均反应时间
距离上次复习时间
```

---

# 24. Web 和 Codex Skill 分工

## Web 负责

- 数据可视化
- 词库管理
- 搜索
- 批量编辑
- 每日复习
- 易混词浏览
- 错词本
- 历史记录
- 统计图表
- 导入导出
- 手动修正数据

## Codex Skill 负责

- 自然语言测试
- 判断用户答案
- 分析错因
- 检测错误映射
- 自动建立易混关系
- 生成例句
- 生成同义词 / 近义词
- 生成专项测试
- 对学习数据进行分析
- 写回 words.json
- 追加 review log

---

# 25. Skill 与网页共享数据

统一目录：

```text
CET4_VOCAB_HOME
```

Windows 默认：

```text
C:\Users\<User>\Documents\CET4-Vocab
```

Skill 读取：

```text
%USERPROFILE%\Documents\CET4-Vocab\data\words.json
```

网页读取同一文件。

这样：

```text
Codex 测试 20 个词
↓
写入 words.json
↓
网页点击重新加载
↓
统计立即更新
```

反向也是一样。

---

# 26. 数据变更来源

建议 `words.json` 顶层记录：

```json
{
  "updated_by": "codex"
}
```

可选：

```text
web
codex
manual
migration
import
```

网页右上角显示：

```text
数据已连接
最后修改：16:51:09
来源：Codex
Revision：54
```

---

# 27. 导入功能

第一版支持：

## CSV

```csv
word,meaning
maintain,保持
significant,显著的
```

## TXT

```text
maintain 保持
significant 显著的
```

## JSON

原生 CET4 Schema。

导入流程：

```text
解析
↓
预览
↓
检查重复
↓
选择覆盖 / 合并 / 跳过
↓
自动备份
↓
写入
```

---

# 28. 导出功能

支持：

```text
JSON
CSV
Markdown
```

例如 Markdown：

```md
# CET4 易混词

## consequence

核心义：后果

易混：
- conclusion：结论

历史错误：
- 结论 × 3
```

---

# 29. 统计页面

建议展示：

## 基础统计

- 总词数
- 新词
- 学习中
- 模糊
- 易混
- 已掌握

## 时间统计

- 今日复习量
- 7 天复习量
- 30 天复习量

## 正确率

- 今日正确率
- 7 天正确率
- 30 天正确率

## 提取速度

- 平均反应时间
- 最慢 Top 20

## 遗忘

- lapses Top 20
- 重复错误 Top 20

---

# 30. 学习热力图

类似 GitHub Contribution：

```text
       一 二 三 四 五 六 日
Week1  ■ ■ □ ■ ■ ■ ■
Week2  ■ ■ ■ ■ □ ■ ■
Week3  ■ ■ ■ ■ ■ ■ ■
```

颜色深浅代表当天测试量。

---

# 31. 浏览器兼容设计

主模式：

```text
Chrome / Edge
↓
File System Access API
↓
直接读写 CET4-Vocab 目录
```

降级模式：

如果浏览器不支持目录直接读写：

```text
手动导入 words.json
↓
网页管理
↓
导出 words.json
```

这样系统不会完全不可用。

---

# 32. PWA 与离线功能

V1.0 后可加入：

```text
manifest.json
Service Worker
```

效果：

- 可以安装到桌面
- 可在开始菜单运行
- 静态资源离线缓存
- 断网仍可使用

注意：主数据仍保存在 CET4-Vocab 本地目录。

---

# 33. 推荐前端目录结构

```text
cet4-vocab-web/
│
├─ src/
│  ├─ components/
│  │  ├─ Sidebar.tsx
│  │  ├─ Header.tsx
│  │  ├─ WordTable.tsx
│  │  ├─ WordCard.tsx
│  │  ├─ StatCard.tsx
│  │  ├─ ReviewCard.tsx
│  │  ├─ SearchBox.tsx
│  │  └─ ConflictDialog.tsx
│  │
│  ├─ pages/
│  │  ├─ Dashboard.tsx
│  │  ├─ Words.tsx
│  │  ├─ WordDetail.tsx
│  │  ├─ Review.tsx
│  │  ├─ Mistakes.tsx
│  │  ├─ Confusions.tsx
│  │  ├─ Analytics.tsx
│  │  ├─ History.tsx
│  │  ├─ ImportExport.tsx
│  │  └─ Settings.tsx
│  │
│  ├─ services/
│  │  ├─ fileSystem.ts
│  │  ├─ wordRepository.ts
│  │  ├─ reviewRepository.ts
│  │  ├─ backupService.ts
│  │  ├─ importService.ts
│  │  └─ exportService.ts
│  │
│  ├─ algorithms/
│  │  ├─ scheduler.ts
│  │  ├─ scoring.ts
│  │  └─ priority.ts
│  │
│  ├─ db/
│  │  └─ handles.ts
│  │
│  ├─ models/
│  │  ├─ Word.ts
│  │  ├─ Review.ts
│  │  ├─ Config.ts
│  │  └─ Schema.ts
│  │
│  ├─ hooks/
│  │  ├─ useVocabulary.ts
│  │  └─ useDirectoryHandle.ts
│  │
│  ├─ App.tsx
│  └─ main.tsx
│
├─ public/
│  ├─ manifest.json
│  └─ icons/
│
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ tailwind.config.js
└─ README.md
```

---

# 34. Skill 推荐目录结构

后续建议升级 Skill：

```text
cet4-vocab-coach/
│
├─ SKILL.md
│
├─ references/
│  └─ DATA_SCHEMA.md
│
├─ scripts/
│  ├─ vocab.py
│  ├─ repository.py
│  ├─ scheduler.py
│  ├─ backup.py
│  └─ migration.py
│
└─ assets/
   └─ starter_words.json
```

网页与 Skill 共同遵循：

```text
CET4 Data Schema v1
```

---

# 35. V2 可扩展能力

## 35.1 发音

使用浏览器 SpeechSynthesis：

```ts
speechSynthesis.speak(
  new SpeechSynthesisUtterance("consequence")
)
```

## 35.2 听力识义

不显示单词，只播放发音：

```text
🔊 consequence
```

用户回答：

```text
后果
```

## 35.3 中译英

```text
后果
↓
consequence
```

## 35.4 拼写测试

播放发音后输入完整拼写。

## 35.5 多维掌握度

未来每个词可分别记录：

```text
英 → 中
中 → 英
听力识义
拼写
易混辨析
```

例如：

```text
consequence

英 → 中       90%
中 → 英       60%
听力识义      50%
拼写          40%
易混辨析      70%
```

第一版不必实现，保留数据扩展空间即可。

---

# 36. 开发阶段规划

## V0.1：数据核心

必须完成：

- Schema v1
- 数据目录选择
- words.json 读取
- words.json 写入
- revision 检测
- 自动备份
- IndexedDB 保存目录句柄
- 数据完整性检查

这是整个项目最重要的基础。

## V0.2：词库管理

实现：

- Dashboard
- 单词库
- 搜索
- 筛选
- 单词详情
- 新增
- 修改
- 删除
- 易混关系编辑

## V0.3：复习系统

实现：

- 今日复习
- 正确 / 模糊 / 错误
- 反应时间
- 调度算法
- review log
- 当前轮错词重现

## V0.4：统计系统

实现：

- 7 天 / 30 天趋势
- 学习热力图
- 顽固词
- 易混词排行
- 平均反应时间
- 遗忘次数排行

## V0.5：Skill 联动

升级 Codex Skill：

- 遵守 Schema v1
- 使用 revision
- 写 review log
- 自动建立 confused_with
- 支持 source=codex
- 支持数据备份

## V1.0：完整版本

加入：

- PWA
- 导入导出
- 自动备份管理
- 恢复备份
- 发音
- 数据迁移
- 浏览器降级模式
- 完整 README
- Windows 一键启动脚本

---

# 37. 推荐最终使用流程

每天：

```text
打开 CET4 Vocabulary Web
↓
查看 Dashboard
↓
开始今日复习
↓
完成 20~40 词
↓
网页更新 words.json
```

遇到需要 AI 分析时：

```text
打开 Codex
↓
“用 cet4-vocab-coach 测试我今天的重点词”
↓
Skill 读取 words.json
↓
AI 出题
↓
用户回答
↓
AI 判断 + 分析混淆
↓
Skill 写回 words.json
↓
网页重新加载即可看到更新
```

---

# 38. 设计原则总结

整个项目建议始终遵守以下原则：

1. **本地数据优先**
2. **words.json 是唯一事实来源**
3. **网页不维护独立主数据库**
4. **Skill 不依赖聊天上下文保存词汇状态**
5. **所有数据格式版本化**
6. **任何批量操作前自动备份**
7. **网页和 Skill 均检查 revision**
8. **易混词优先于普通生词**
9. **主动提取优先于被动浏览**
10. **反应时间也是掌握程度的一部分**

---

# 39. 第一版建议范围

为了尽快得到真正可用的版本，第一版建议只实现：

```text
√ 数据目录连接
√ Dashboard
√ 单词库
√ 搜索 / 筛选
√ 单词详情
√ 新增 / 编辑 / 删除
√ 易混词
√ 今日复习
√ 正确 / 模糊 / 错误
√ 简单间隔复习
√ 反应时间
√ 错误记录
√ JSONL 历史
√ 自动备份
√ revision 冲突检测
√ CSV / JSON 导入导出
√ Codex Skill 共用同一数据
```

暂不优先：

```text
× 云服务器
× 在线数据库
× 用户账号
× AI API 接入网页
× 复杂 SM-2 / FSRS
× 多人协作
```

这能保持系统简单、可靠、完全免费，并非常适合个人长期使用。

---

# 40. 最终形态

```text
┌──────────────── CET4 Vocabulary ────────────────┐
│                                                │
│                 本地数据层                      │
│                                                │
│                words.json                      │
│                    ↑ ↓                         │
│          ┌─────────┴─────────┐                 │
│          │                   │                 │
│          ▼                   ▼                 │
│                                                │
│      Static Web          Codex Skill           │
│                                                │
│      管理 / 查看          AI 测试               │
│      每日复习             错因分析               │
│      数据统计             易混识别               │
│      编辑词库             个性化出题             │
│                                                │
└────────────────────────────────────────────────┘
```

最终目标不是做一个普通“背单词网页”，而是形成一个：

> **完全本地、数据可控、AI 可参与、长期不会因为聊天上下文丢失而失忆的个人 CET-4 词汇学习系统。**
