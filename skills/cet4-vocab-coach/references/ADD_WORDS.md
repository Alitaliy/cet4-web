# 批量补充新词

适用于“用 cet4-vocab-coach 帮我补充下一批 20 个四级新词，保存到网页共用词库，暂时不用测试”等请求。

## 读取与选词

先执行 `python scripts/vocab.py --home <共用数据目录> catalog --json`，保留 `home`、`revision`、`words` 和 `new_count`。未指定自定义目录时按 SKILL.md 的默认路径执行。若目录没有词库，先确认网页连接的实际目录；不要为完成补词另建一份 48 词词库。用户已经提供过目录时直接沿用。

根据用户的数量和主题选词，默认 20 个 CET-4 学习中常用的词。先排除 catalog 中所有词，不用词形变化凑数。用户提供指定词表时优先从中选取；否则由当前 Codex 选词并概括核心中文义，可标注“AI 选词”，不能声称来自官方完整词表或未经核实的高频排名。对不确定的拼写、词义或搭配查证可靠词典；例句使用原创表达。

用户只要求补词时，即使还有未学新词也不额外阻止操作，可简短告知已有新词数量。新词保持未测试；不要生成答题记录、正确率或错误映射。相似词不自动写入 `confused_with`。

## 批量保存

在用户数据目录的 `exports/` 中生成 UTF-8 JSON 文件，使用唯一文件名避免覆盖先前批次；用文件编辑工具或显式 UTF-8 写入，避免 Windows 默认管道编码损坏中文。示例格式（实际应生成用户要求的数量）：

```json
{
  "expected_revision": 12,
  "words": [
    {
      "word": "abundant",
      "core_meaning": "丰富的；充足的",
      "pos": "adj.",
      "tags": ["AI选词", "资源与环境"],
      "collocations": ["abundant resources"],
      "notes": "例句：The region has abundant water resources. 该地区水资源丰富。"
    }
  ]
}
```

`word`、`core_meaning` 必填；可选字段为 `pos`、`phonetic`、`notes`、`tags`、`collocations`、`synonyms`、`antonyms`、`word_family`。不确定音标时可留空。不接收成绩、状态、调度或历史字段。

执行 `python scripts/vocab.py --home <共用数据目录> add-batch <批次文件>`，接着运行 `validate` 验证词库。脚本将英文转为小写并去除首尾空格，跳过已有词及批内重复词，整批校验后只提交一次；通过现有备份、revision 和事务恢复流程保存。若这一批全部已存在，不改动词库、成绩、历史或 revision。

读取实际输出的 `added`、`words`、`skipped_existing`、`skipped_duplicates`、`total` 和 `revision`。不得把候选数量当成新增数量。如果去重导致数量不足，按最新 catalog 补足差额，最多补一次；仍不足就如实报告。遇到 revision 冲突，重新读取 catalog 并核对本批单词后，用最新版本重试一次；仍冲突则保留批次文件并说明尚未完成保存。

## 网页与训练

保存后提示用户在拾词网页点击“重新加载”，到“我的词库”筛选“新词”查看。本批新词进入每日复习候选池；每日队列继续优先到期词，并混合新词，不承诺下一轮只出现这批词。

用户同时要求测试这批新词时，以 `add-batch` 实际返回的 `words` 为本轮范围，通过 `show` 读取词义，用保存后 revision 执行 SKILL.md 的判分和 `record-batch` 流程。只向用户出示英文题目，不提前展示答案。
