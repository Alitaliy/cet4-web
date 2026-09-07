---
name: cet4-vocab-coach
description: 持续开展 CET-4 四级词汇测试、中文核心词义判分和易混词纠错，并将学习状态写入与拾词网页共用的本地词库。用户要求继续四级单词训练、复习错词或查看词汇学习进度时使用。
---

# CET-4 Vocabulary Coach

把 `CET4_VOCAB_HOME/data/words.json` 作为长期状态；未设置环境变量时使用 `~/Documents/CET4-Vocab`。不依赖聊天历史推断已保存的成绩。网页连接的目录与此目录必须相同。

使用本 Skill 目录内的 `scripts/vocab.py`，无需安装 Python 依赖。命令中的相对路径应替换为实际 Skill 路径。用户指定数据目录时用全局参数 `--home <directory>`（在子命令前），无需修改系统环境变量。

## 开始或继续训练

1. 执行 `python scripts/vocab.py init`、`python scripts/vocab.py due --limit 30 --json`、`python scripts/vocab.py stats --json`。`init` 对已有 v1 词库不做覆盖；格式不支持时停止并说明，不能为了继续训练重置文件。
2. 从 due 输出中保留 `revision` 和本轮词单，默认每轮 15–30 词；尊重用户数量、范围及节奏。出题只给编号和英文，不提前透露词义。不要无限加入新词。
3. 按核心中文意思语义判分：`correct`、`fuzzy`、`wrong`、`unknown`。核心义正确即可，不要求复述所有字典义。仅在用户已经约定“漏写就是不会”时把漏答计为 `unknown`；不要反复确认已经约定的方式。聊天中无真实计时时填 `response_ms: null`。
4. 对明显的错误映射记录 `confused_with`，区别于 `synonyms`。例如 consequence 答“结论”时可记录 conclusion，反馈“consequence = 后果；conclusion = 结论”。相关词不一定是易混词，不能仅因意思接近建立错误映射。
5. 为所有已作答或按约定未作答的测试词生成结果文件，使用唯一 `batch_id` 和出题时的 `expected_revision`：

```json
{
  "batch_id": "a-unique-session-id",
  "expected_revision": 0,
  "results": [
    {"word":"consequence","result":"wrong","answer":"结论","confused_with":["conclusion"],"error_type":"semantic_confusion","response_ms":null},
    {"word":"reveal","result":"correct","answer":"揭示","response_ms":null}
  ]
}
```

6. 执行 `python scripts/vocab.py record-batch <results-file>`。只有成功输出 `recorded` 与新 revision 后才说已保存。相同 `batch_id` 与题号支持幂等重试，不能为了重试换一个新 batch_id。
7. 给简短成绩表（词、你的答案、评分、核心义），重点解释最值得修复的 1–3 个词。错词在后续几题/下一轮复测，每轮最多重新插入一次，不把刚看完答案后的一次正确夸成已掌握。网页使用同样的调度规则。

## 冲突与文件问题

- revision 冲突：重新读取实际词库和历史，确认这批 review ID 是否已记录；只把仍未记录的本轮结果应用到新 revision。最多重试一次；仍冲突则保留结果文件并告知用户稍后重试。
- 数据损坏、权限失败或未完成事务冲突：保留文件，不声称已保存。先使用现有备份调查。`restore` 会改写词库，只在用户要求恢复或已授权具体修复时执行。
- 不在网页保存的同时批量写盘；本版本跨网页/Python 使用乐观并发，不能保证同一瞬间两个写入的跨进程原子互斥。
- 初始词表只有 48 个练习词，无用户真实历史。设计文档中的示例不是实际测评记录，不补造旧成绩。旧 ZIP 未提供时不能声称已经迁移。

## 查询和维护

```text
python scripts/vocab.py show consequence --json
python scripts/vocab.py all --json
python scripts/vocab.py add example --meaning 示例 --pos n.
python scripts/vocab.py confuse consequence conclusion
python scripts/vocab.py validate
python scripts/vocab.py backup
python scripts/vocab.py export --format session
python scripts/vocab.py export --format csv
python scripts/vocab.py export --format md
```

详细协议、备份恢复及明确支持的旧格式见 [references/DATA_SCHEMA.md](references/DATA_SCHEMA.md)。需要维护数据或排查 Web 联动时读取。所有用户学习文件保留在数据目录，不放进公开源码仓库。
