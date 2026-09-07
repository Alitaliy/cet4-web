# CET4 Data Schema v1

主文件：`data/words.json`。两端均要求 `schema_version: 1`、非负整数 `revision`、ISO `updated_at` 和 `updated_by`（web / codex / manual / import / migration）。`words` 是按小写单词索引的对象。未知扩展字段在验证及保存时保留。

每个 Word 包含：word、phonetic、core_meaning、meanings[{pos,zh,primary}]、status、tags、confused_with、wrong_answers、synonyms、antonyms、word_family、collocations、stats、schedule、last_review、created_at、updated_at、notes。词形可包含英文字母、空格、连字符及撇号；键必须等于 word。

- status：new / learning / fuzzy / confusing / mastered / suspended。
- stats：seen、correct、wrong、fuzzy、streak、lapses 均为非负整数；seen = correct + wrong + fuzzy，unknown 计入 wrong。avg_response_ms 可为 null；可选 response_count 专门计数有真实用时的答题，避免混入未计时的聊天记录。
- schedule：stage、interval_days 为非负整数，due_at 为本地日历日期 YYYY-MM-DD。
- last_review：null 或 {result, answer, response_ms, at}。
- review result：correct / fuzzy / wrong / unknown。source：web / codex / manual / import。
- 历史：`data/reviews/YYYY-MM.jsonl`，按 review.time 字符串中的月份分文件，每行 {id,word,time,result,answer,response_ms,source,error_type?}。保留历史原有行，追加新 ID；中断重试按 ID 去重。
- 配置：`data/config.json` 中 daily_limit (5–100)、backup_limit (5–100)、slow_response_ms (1000–30000)。默认 30 / 30 / 5000。

## 保存与恢复

两端保存前均校验完整文件并比较所读 revision 和内容；不接受手改内容但未增加 revision 的盲覆盖。每次词库变更先存 backups/words_*.json，保留最近 backup_limit 份（手动快照在下一次自动清理时也按此策略处理）。恢复也先备份当前状态并增加当前 revision，绝不倒退 revision。

跨文件事务：先写 `data/pending.json`，包含 {schema_version:1,before,after,reviews}；再替换 words.json；追加月份日志；最后删除 pending。初始化时 before 为 null。下次加载会幂等完成与 before 或 after 匹配的事务；若磁盘内容与两者均不匹配，停止并保留现场。Python 用临时文件、fsync、os.replace；网页使用 createWritable 的关闭提交。不要手工删除 pending 后声称已恢复。

Python 的 `.codex-write.lock` 只串行化 CLI 进程；网页使用 Web Locks 串行化同源标签页。跨网页/CLI 的乐观检查存在检查后到提交前的极短竞争窗口，使用时交替操作并重新加载。不要对外称“绝对不会并发丢数据”。CLI 进程异常终止可能留锁；确认 PID 已停止后才能删除该锁。

备份只回滚 words.json，不删历史。因此快照恢复后词条统计和累计历史统计可以不同。完整迁移数据目录时复制整个目录；手动浏览器模式导出 `cet4-session-v1` JSON，包含 library、reviews、config。

## 调度

correct 的连续正确次数 1/2/3/4/5/6/7+ 对应 1/2/4/7/15/30/60 天。wrong/unknown：连对归零，wrong 与 lapses +1，次日到期；当前轮后段额外测试一次。fuzzy：连对归零，次日到期。正确但用时超过 slow_response_ms 时最多间隔 4 天；连续正确至少 6 次且本题不慢才标记 mastered。suspended 不参加自动出题。

每日队列优先安排 60% 到期、20% 顽固/模糊/易混、20% 新词，不足时从这些池中补齐且不重复；不会为凑数提前测试其他未来到期的熟词。

## 迁移

`python scripts/vocab.py migrate` 对有效 v1 仅校验、不改 revision。

`migrate <legacy.json>` 支持明确的 `[{word,meaning,...v1-compatible fields}]` 或 `{words:{word:"中文义"}}` / `{words:{word:{meaning,...}}}`。原文件先复制到 backups/legacy_*.json。兼容字段保留，其余字段作为扩展保留；不凭空把未知旧计数推成新统计。重复词拒绝迁移，可通过 Web 的导入预览选择合并或覆盖。带 schema_version 的输入必须是有效 v1；未知 v2 或未提供格式的旧 ZIP 必须人工确认结构，不能猜测覆盖。

## 常见恢复命令

```text
python scripts/vocab.py backup
python scripts/vocab.py restore <backup-file>
python scripts/vocab.py validate
```

恢复后网页点“重新加载”。不要将静态网页的 GitHub 仓库目录选作个人数据目录；默认个人目录位于仓库之外。
