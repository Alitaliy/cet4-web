# CET-4 Vocabulary Coach Skill 设计方案

> 目标：构建一个可长期使用、可跨对话持续、可与静态网页共享数据的 **CET-4 个性化词汇教练 Skill**。
>
> 核心原则：**Skill 负责“理解与决策”，本地文件负责“长期记忆”，网页负责“可视化管理”。**
>
> 本方案与《CET-4 Vocabulary Web 管理系统实现方案》配套使用，两者共用 **CET4 Data Schema v1**。

---

# 1. 设计目标

本 Skill 主要解决以下问题：

1. 聊天上下文过长后，早期词汇测试结果可能不再可见。
2. 用户存在大量“见过、会读、但提取不出意思”的半熟词。
3. 用户存在明显的形近词/错误映射问题，例如：
   - `consequence` → 错答为“结论”
   - `affect` → 错答为“效果”
   - `previous` → 错答为“预览”
   - `appropriate` → 错答为“感谢”
4. 普通单词表只记录“会/不会”，无法保存：
   - 模糊程度
   - 错误答案
   - 易混词
   - 连续正确次数
   - 历史复习记录
   - 下次复习日期
   - 反应时间
5. 希望 Codex 在新对话中可以直接延续上一次学习状态，而不是重新询问用户。
6. 希望 Skill 与静态网页操作同一份本地词库，不产生两套状态。

最终目标：

```text
用户对话
   │
   ▼
CET4 Vocabulary Coach Skill
   │
   ├─ 选词
   ├─ 出题
   ├─ 语义判分
   ├─ 错因分析
   ├─ 易混识别
   ├─ 复习调度
   └─ 学习建议
   │
   ▼
本地 CET4-Vocab 数据目录
   ▲
   │
静态 Web 管理页面
```

---

# 2. Skill 的职责边界

## 2.1 Skill 应该负责

Skill 负责 AI 更擅长的部分：

- 根据本地学习状态挑选今天应该复习的单词
- 生成分层测试
- 理解用户自然语言答案
- 判断：正确 / 模糊 / 错误 / 不会
- 识别错误映射
- 判断是否属于形近词混淆
- 给出精简、针对性的纠错
- 自动建立易混词对
- 生成短语、例句和辨析提示
- 根据历史表现调整单词状态
- 将每次测试结果写入本地数据
- 在后续对话中恢复学习上下文
- 生成阶段性学习报告

## 2.2 Skill 不应该负责

Skill 不应该成为唯一的数据存储层。

禁止依赖：

```text
聊天历史
模型记忆
当前上下文
临时笔记
```

作为唯一学习状态。

Skill 也不负责：

- 做复杂 GUI
- 维护独立于网页之外的第二份词库
- 在没有写盘成功时声称“已经记录”
- 每次测试都重新从零判断用户水平
- 把所有字典义一次性灌给用户

---

# 3. 长期状态设计

长期状态统一保存在：

```text
CET4_VOCAB_HOME
```

如果环境变量未设置，则默认：

```text
~/Documents/CET4-Vocab
```

Windows 示例：

```text
C:\Users\<User>\Documents\CET4-Vocab
```

推荐目录：

```text
CET4-Vocab/
│
├─ data/
│  ├─ meta.json
│  ├─ config.json
│  ├─ words.json
│  └─ reviews/
│     ├─ 2026-09.jsonl
│     ├─ 2026-10.jsonl
│     └─ ...
│
├─ backups/
│  ├─ words_2026-09-07_165830.json
│  └─ ...
│
├─ exports/
│  ├─ words.csv
│  ├─ summary.md
│  └─ mistakes.md
│
└─ logs/
```

**`data/words.json` 是词汇状态的唯一主数据源。**

---

# 4. Skill 项目结构

推荐将现有 Skill 升级为：

```text
cet4-vocab-coach/
│
├─ SKILL.md
│
├─ references/
│  ├─ DATA_SCHEMA.md
│  ├─ GRADING_POLICY.md
│  ├─ REVIEW_POLICY.md
│  └─ EXAMPLES.md
│
├─ scripts/
│  ├─ vocab.py
│  ├─ repository.py
│  ├─ scheduler.py
│  ├─ backup.py
│  ├─ migration.py
│  ├─ validator.py
│  └─ utils.py
│
├─ assets/
│  ├─ starter_words.json
│  └─ cet4_seed_words.json
│
└─ tests/
   ├─ test_repository.py
   ├─ test_scheduler.py
   ├─ test_migration.py
   └─ fixtures/
```

其中：

### `SKILL.md`

只保留 Skill 的行为规范和工作流，不塞入大量实现细节。

### `references/DATA_SCHEMA.md`

网页和 Skill 共用的数据协议。

### `repository.py`

统一负责读写 `words.json` 和 review 日志。

### `scheduler.py`

只负责复习时间、优先级和状态迁移。

### `backup.py`

写入前创建备份。

### `migration.py`

用于未来 Schema 升级，例如：

```text
v1 → v2
```

### `validator.py`

检查数据完整性，避免网页或手工修改造成文件损坏。

---

# 5. 数据协议

Skill 与 Web 必须共享：

```text
CET4 Data Schema v1
```

核心 `words.json`：

```json
{
  "schema_version": 1,
  "revision": 53,
  "updated_at": "2026-09-07T16:50:00+08:00",
  "updated_by": "codex",
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
      "tags": ["CET4", "high-frequency"],
      "confused_with": ["conclusion"],
      "wrong_answers": {
        "结论": 2
      },
      "synonyms": ["result", "outcome"],
      "antonyms": [],
      "word_family": [],
      "collocations": ["as a consequence"],
      "stats": {
        "seen": 5,
        "correct": 2,
        "wrong": 3,
        "fuzzy": 0,
        "unknown": 0,
        "streak": 0,
        "lapses": 2,
        "avg_response_ms": null
      },
      "schedule": {
        "stage": 1,
        "interval_days": 0,
        "due_at": "2026-09-07"
      },
      "last_review": {
        "result": "wrong",
        "answer": "结论",
        "source": "codex",
        "at": "2026-09-07T16:30:00+08:00"
      },
      "created_at": "2026-09-07T15:50:00+08:00",
      "updated_at": "2026-09-07T16:30:00+08:00",
      "notes": "Repeated confusion with conclusion"
    }
  }
}
```

---

# 6. 单词状态模型

建议定义：

```text
new
learning
fuzzy
confusing
mastered
suspended
```

## `new`

尚未正式测试。

## `learning`

已经进入学习流程，但还没有稳定掌握。

## `fuzzy`

用户能说出方向，但不够准确或提取速度过慢。

例如：

```text
considerable → “很大？重要？”
```

## `confusing`

存在稳定的错误映射或易混词。

例如：

```text
consequence → 结论
```

应标记：

```text
confused_with = ["conclusion"]
```

## `mastered`

多次跨间隔快速正确，不是“刚看答案后答对一次”。

## `suspended`

暂时不参与自动复习。

---

# 7. 判分模型

Skill 使用四级判分：

```text
correct
fuzzy
wrong
unknown
```

## 7.1 correct

用户能够在合理时间内说出核心意思。

例如：

```text
maintain → 保持
```

即使字典还包含“维修、供养”等其他义，也应判正确。

核心原则：

> 四级阶段优先测试“核心识义”，不是词典背诵。

## 7.2 fuzzy

方向基本正确，但存在明显不确定、缺失或过度模糊。

例如：

```text
concern → “关心？”
```

若测试目标是“关注；担忧”，可以判 fuzzy 或 correct，取决于上下文。

## 7.3 wrong

含义明显错误。

例如：

```text
affect → 效果
```

这种情况不仅要判错，还需要检测：

```text
effect → 效果
```

并建立易混关系。

## 7.4 unknown

用户没有回答，且已约定“没写就是不会”。

用户若明确采用这种答题方式，Skill 不得重复询问漏答词是否不会。

---

# 8. 错误类型识别

Skill 应将错误进一步分型：

```text
unknown_meaning
fuzzy_recall
lookalike_confusion
semantic_confusion
slow_retrieval
wrong_part_of_speech
```

## 8.1 unknown_meaning

完全没有建立词义连接。

例如：

```text
indicate → 无答案
```

## 8.2 fuzzy_recall

有模糊印象，但不稳定。

## 8.3 lookalike_confusion

把相似词形的词混淆。

例如：

```text
previous → 预览
preview  → 预览
```

## 8.4 semantic_confusion

词形不同，但意思错误绑定。

## 8.5 slow_retrieval

最终正确，但耗时明显过长。

此功能主要由 Web 记录反应时间后提供给 Skill 使用。

---

# 9. 易混词模型

易混词不是 synonym。

必须严格区分：

```text
confused_with  = 易混淆词
synonyms       = 同义词/近义词
related_words  = 语义相关词
word_family    = 同根词
```

例如：

```text
consequence
├─ confused_with: conclusion
├─ synonyms: result, outcome
└─ related_words: cause
```

不能把：

```text
conclusion
```

错误放进 `synonyms`。

---

# 10. 易混词纠错模板

Skill 发现错误映射后，优先给：

```text
consequence ≠ 结论
consequence = 后果
conclusion = 结论
```

必要时加一个极短例子：

```text
as a consequence = 因此 / 结果
```

不要一次给 5 个例句和 8 个词义。

核心思想：

> 修复错误索引，而不是增加信息负担。

---

# 11. 复习调度

第一版使用简单、可解释的间隔复习。

推荐：

```text
wrong / unknown
→ 当前轮后段再次出现
→ 当天或次日再次复习

fuzzy
→ 1 天

correct streak 1
→ 1 天

correct streak 2
→ 2 天

correct streak 3
→ 4 天

correct streak 4
→ 7 天

correct streak 5
→ 15 天

correct streak 6
→ 30 天

correct streak 7+
→ 60 天
```

若中途错误：

```text
streak = 0
lapses += 1
```

并降低 stage。

---

# 12. 单词优先级算法

每天默认出 30~40 个词。

推荐配比：

```text
60% 到期复习词
20% 顽固 / 易混词
20% 新词
```

若用户错词很多，可动态改为：

```text
70% 到期 + 易混
20% 半熟词
10% 新词
```

优先级：

```text
重复混淆
>
重复错误
>
到期 unknown
>
到期 fuzzy
>
到期 learning
>
新词
>
mastered
```

---

# 13. 每轮测试流程

标准流程：

## Step 1：读取本地状态

Skill 开始训练前：

```bash
python scripts/vocab.py init
python scripts/vocab.py due --limit 40 --json
python scripts/vocab.py stats --json
```

不能只依赖当前聊天。

## Step 2：生成测试

默认 15~30 个词一轮。

用户已经明确的习惯：

> 只写“知道或模糊”的序号，没写的就是完全不知道。

Skill 应保持兼容。

## Step 3：判分

对每个词形成结构化结果：

```json
{
  "word": "affect",
  "result": "wrong",
  "answer": "效果",
  "confused_with": ["effect"],
  "error_type": "lookalike_confusion"
}
```

## Step 4：批量写盘

所有测试词都必须记录。

```bash
python scripts/vocab.py record-batch results.json
```

## Step 5：反馈

反馈优先输出：

- 正确率
- 最值得修复的词
- 易混词
- 1~2 个最明显的学习问题

不要每轮都输出一大篇英语学习理论。

## Step 6：复测

对刚纠正的顽固词，可在几轮之后重新插入测试。

---

# 14. 本地命令设计

建议 `vocab.py` 作为统一 CLI 入口。

## 初始化

```bash
python scripts/vocab.py init
```

作用：

- 创建目录
- 创建配置
- 创建 `words.json`
- 初始化 starter data
- 检查 Schema

## 查询今日词

```bash
python scripts/vocab.py due --limit 30 --json
```

## 查询全部词

```bash
python scripts/vocab.py all --json
```

## 查询单词

```bash
python scripts/vocab.py show consequence --json
```

## 查看统计

```bash
python scripts/vocab.py stats --json
```

## 批量记录测试

```bash
python scripts/vocab.py record-batch /path/to/results.json
```

## 添加单词

```bash
python scripts/vocab.py add consequence --meaning "后果；结果"
```

## 建立易混关系

```bash
python scripts/vocab.py confuse consequence conclusion
```

## 导出

```bash
python scripts/vocab.py export --format csv
python scripts/vocab.py export --format md
```

## 校验

```bash
python scripts/vocab.py validate
```

## 备份

```bash
python scripts/vocab.py backup
```

## 恢复

```bash
python scripts/vocab.py restore <backup-file>
```

---

# 15. `record-batch` 数据格式

输入建议：

```json
[
  {
    "word": "consequence",
    "result": "wrong",
    "answer": "结论",
    "core_meaning": "后果；结果",
    "confused_with": ["conclusion"],
    "error_type": "lookalike_confusion",
    "response_ms": null,
    "notes": "Repeated wrong mapping"
  },
  {
    "word": "reveal",
    "result": "correct",
    "answer": "揭示",
    "response_ms": null
  }
]
```

执行后：

1. 更新 `words.json`
2. 增加 `revision`
3. 更新 `updated_at`
4. 设置 `updated_by = "codex"`
5. 追加 review 日志
6. 更新 schedule
7. 更新错误计数
8. 更新易混关系

---

# 16. Review 历史日志

每次测试追加到：

```text
data/reviews/YYYY-MM.jsonl
```

例如：

```json
{"id":"r001","word":"affect","time":"2026-09-07T16:20:32+08:00","result":"wrong","answer":"效果","error_type":"lookalike_confusion","source":"codex"}
{"id":"r002","word":"reveal","time":"2026-09-07T16:21:04+08:00","result":"correct","answer":"揭示","source":"codex"}
```

历史日志应尽量采用 append-only。

这样可以方便：

- 学习趋势分析
- 找出顽固词
- 回溯错误答案
- 重建统计
- 修复主文件

---

# 17. 与静态网页的数据同步

Skill 和网页操作同一份：

```text
data/words.json
```

因此必须处理并发。

采用：

## 乐观并发控制

每次读取时记住：

```text
revision = 53
```

写入前再次读取磁盘 revision。

如果仍为 53：

```text
写入成功
revision → 54
```

如果已经变成 54：

```text
拒绝盲目覆盖
重新读取
合并后重试
```

Skill 不应该在 revision 冲突时直接覆盖网页刚写入的数据。

---

# 18. 写入安全

推荐所有写入流程：

```text
读取当前文件
↓
校验 schema
↓
检查 revision
↓
创建备份
↓
写临时文件 words.json.tmp
↓
fsync / flush
↓
原子替换 words.json
↓
追加 review log
```

禁止直接：

```python
open("words.json", "w")
```

然后一次性覆盖而没有备份。

---

# 19. 自动备份

写入前至少支持：

```text
backups/words_YYYY-MM-DD_HHMMSS.json
```

建议：

```text
保留最近 30 份
```

另外每天首次写入时保留一个 daily snapshot。

---

# 20. Schema 校验

Skill 每次启动至少检查：

- `schema_version`
- `revision`
- `words` 是否为对象
- 每个 word key 与 `word` 字段是否一致
- schedule 字段是否合法
- stats 数字是否非负
- `confused_with` 是否是数组
- review result 是否为合法枚举

若检测异常：

1. 不继续盲写
2. 先备份损坏文件
3. 尝试修复或提示用户

---

# 21. Schema 迁移

未来可能升级：

```text
v1
↓
v2
```

例如未来增加：

```text
recognition_score
listening_score
spelling_score
reverse_recall_score
```

不能直接让新代码读取旧格式并假设字段存在。

所以：

```bash
python scripts/vocab.py migrate
```

负责：

- 判断当前版本
- 创建备份
- 逐级迁移
- 校验
- 更新 schema_version

---

# 22. Skill 的对话行为规范

Skill 应保持以下风格。

## 22.1 出题时

简洁。

例如：

```text
1. consequence
2. reveal
3. essential
4. affect
...
```

不提前透露答案。

## 22.2 用户作答后

优先给表格：

```text
词        你的答案   结果   核心义
```

然后只解释最关键的易混词。

## 22.3 不要过度教学

对于已经明确掌握的词：

```text
maintain → 保持
```

不要重复输出长解释。

## 22.4 针对顽固词

如果一个词连续错两次以上，应采用对比式纠错，而不是重复显示同一个定义。

---

# 23. 个性化学习策略

Skill 应逐步形成用户画像，但画像只基于词汇学习行为，不依赖敏感信息。

可记录：

```text
高频错误类型
平均正确率
易混词比例
unknown 比例
fuzzy 比例
新词吸收速度
复测保持率
```

例如：

```text
主要问题：形近词混淆
次要问题：词义首次提取弱
优势：纠正后短期保持较好
```

之后选题时自动多安排：

```text
previous / preview
appropriate / appreciate
particular / participate
```

---

# 24. 新词引入策略

新词不能无限加。

默认每天最多：

```text
20~30 个真正需要学习的新词
```

Skill 可以测试 40~50 个，但其中应包含大量已学复习词。

对于首次出现的新词：

- 先测
- 会 → 记录为已有掌握
- 模糊 → learning/fuzzy
- 不会 → learning
- 错映射 → confusing

---

# 25. “会读但不知道意思”的专门处理

此类词不能判为掌握。

掌握标准优先采用：

```text
看到词
↓
2~3 秒内
↓
提取核心意思
```

如果网页提供 `response_ms`，Skill 可以结合速度判断。

例如：

```text
correct + 1200 ms
→ 强正确

correct + 9000 ms
→ 可记录 correct，但优先级仍较高
```

V2 可增加：

```text
retrieval_strength
```

---

# 26. 与 Web 的职责分工

## Skill

```text
理解答案
智能判分
识别混淆
生成纠错
选题策略
学习分析
自然语言交互
```

## Web

```text
数据可视化
手工编辑
搜索筛选
复习界面
反应时间
统计图表
导入导出
备份恢复 UI
```

## 本地文件

```text
长期状态
唯一真相来源
```

三者关系：

```text
          Skill
           │
           │
           ▼
      words.json
           ▲
           │
           │
          Web
```

---

# 27. 初始词库迁移

当前 Skill ZIP 中已经包含：

```text
assets/starter_words.json
```

包含前期测试得到的初始数据。

升级到 Web Schema 后，需要提供 migration：

```text
旧 starter_words.json
        ↓
CET4 Data Schema v1
        ↓
data/words.json
```

首次 `init`：

1. 若新数据目录不存在：创建
2. 若 `words.json` 不存在：导入 starter words
3. 若存在旧版数据：迁移
4. 若已有 v1：绝不重复覆盖

---

# 28. 推荐的初始重点词

根据前期测试，至少应保留这些历史状态：

```text
consequence → 易误为 conclusion

affect → 易误为 effect

previous → 易误为 preview

appropriate → 易误为 appreciate

particular → 易误为 participate

eventually → 易误为 especially

assume → 曾与 considerable 错误绑定

essential → 多次提取失败

indicate → 多次提取失败

circumstance → 多次提取失败

considerable → 顽固词

reveal → 已开始稳定

acquire → 已开始稳定

preserve → 已开始稳定
```

这些数据必须通过 starter/migration 保留，而不是让用户重新测试。

---

# 29. 安装方案

Codex Skill 推荐安装到：

```text
~/.codex/skills/cet4-vocab-coach/
```

Windows：

```text
C:\Users\<User>\.codex\skills\cet4-vocab-coach\
```

目录中应直接存在：

```text
SKILL.md
```

而不是多嵌套一层错误目录。

正确：

```text
.codex/skills/cet4-vocab-coach/SKILL.md
```

---

# 30. 环境变量

支持：

```text
CET4_VOCAB_HOME
```

例如 Windows PowerShell：

```powershell
$env:CET4_VOCAB_HOME = "D:\Study\CET4-Vocab"
```

长期设置可写入用户环境变量。

这样可以把数据目录放到：

- OneDrive
- Koofr 同步目录
- NAS 同步目录
- Git 私有仓库外部目录

但不建议两台设备同时写同一云同步文件。

---

# 31. 日志设计

`logs/` 用于保存运行级日志，不与学习历史混合。

例如：

```text
logs/skill-2026-09-07.log
```

记录：

- init
- migration
- write success
- revision conflict
- backup
- validation error

不要记录无意义的大段对话内容。

---

# 32. 测试策略

## repository tests

测试：

- 初始化
- 正常读写
- 原子写入
- revision 冲突
- JSON 损坏
- 备份恢复

## scheduler tests

测试：

- correct
- fuzzy
- wrong
- unknown
- streak 增长
- lapse 重置
- due date 变化

## migration tests

测试：

- old → v1
- v1 重复 migrate 不改变数据
- migration 失败回滚

## integration tests

测试完整流程：

```text
init
↓
due
↓
record-batch
↓
show
↓
stats
↓
export
```

---

# 33. 异常处理

## 数据目录不可访问

Skill 应明确说：

```text
本地 CET4 数据目录当前不可访问，本轮可以临时继续，但结果不会持久化。
```

不能声称已保存。

## revision 冲突

Skill：

1. 重新读取
2. 合并当前测试词的变更
3. 再尝试提交
4. 若仍冲突，停止并报告

## JSON 损坏

Skill：

1. 创建损坏文件副本
2. 尝试最近备份恢复
3. 校验
4. 恢复失败则停止写入

---

# 34. 安全原则

- 所有学习数据保留在用户本地目录
- 不需要外部数据库
- 不需要额外 API Key
- 不主动上传单词学习记录
- 所有自动修改必须可追溯
- 备份必须可恢复
- 网页和 Skill 都不能绕过 revision 机制盲写

---

# 35. 推荐版本路线

## V0.1 — 当前基础版

已有：

- `SKILL.md`
- `vocab.py`
- starter words
- 基础 due / record / stats / export
- 本地持久化

## V0.2 — 数据层重构

实现：

- `repository.py`
- 统一 `CET4 Data Schema v1`
- `data/words.json`
- review JSONL
- revision
- backup
- validator

这是和 Web 联动之前最重要的一步。

## V0.3 — 智能复习

实现：

- 错误类型
- confusing pair
- 优先级算法
- 动态新词比例
- 更稳定的 scheduler

## V0.4 — Web 联动

实现：

- 与静态网页共用数据
- revision conflict
- `updated_by`
- Web response time 数据读取

## V0.5 — 报告与分析

实现：

- 7天 / 30天学习总结
- 顽固词排行
- 易混词网络
- 复测保持率
- 掌握趋势

## V1.0 — 稳定长期版

包含：

- 完整 Schema
- Web + Skill 双端稳定同步
- Migration
- Backup / Restore
- Validator
- 全套测试
- 安装说明
- 数据导入导出

---

# 36. 推荐的 V1 工作流

用户每天只需要说：

```text
继续四级单词训练
```

Skill 自动执行：

```text
读取本地数据
↓
检查到期词
↓
识别顽固词
↓
补少量新词
↓
生成测试
↓
用户回答
↓
AI 语义判分
↓
分析易混词
↓
写入 words.json
↓
追加 review log
↓
更新复习时间
↓
返回精简纠错和下一轮建议
```

用户不需要：

- 重新说明之前错过什么
- 手动复制错词
- 提醒 Codex 哪些词已经学过
- 依赖聊天历史保存状态

---

# 37. 最终设计原则

整个系统应遵守下面 8 条：

1. **文件优先于聊天记忆。**
2. **核心词义优先于词典全义。**
3. **主动提取优先于重复浏览。**
4. **错误映射优先于普通生词。**
5. **复测优先于无限增加新词。**
6. **Skill 与 Web 必须共享同一 Schema。**
7. **所有写入必须可备份、可校验、可恢复。**
8. **用户无需为了上下文丢失而重复提供历史学习信息。**

---

# 38. 推荐最终组合

```text
┌───────────────────────────────┐
│   CET4 Vocabulary Web         │
│                               │
│ 管理 / 搜索 / 统计 / 复习 UI  │
└───────────────┬───────────────┘
                │
                ▼
        CET4 Data Schema v1
          data/words.json
          data/reviews/*.jsonl
                ▲
                │
┌───────────────┴───────────────┐
│ CET4 Vocabulary Coach Skill   │
│                               │
│ 测试 / 语义判分 / 易混分析     │
│ 调度 / 纠错 / 学习策略          │
└───────────────────────────────┘
```

这套设计完成后，Skill 就不再是“一个聊天提示词”，而是一个真正有本地持久化状态、可跨对话延续、可与 Web 管理端协同工作的长期学习工具。
