# 路由器 QA · 2026-10-26

> 数据集：`multi-role-groupchat/qa/router/cases.json` · 运行器：`qa/router/run.mjs`
> 基线报告：`qa/reports/router-local.md`（本地规则，无模型、无 key）

## 结论

- 86 条中文样本，67 条标记为本地规则应直接命中；实测 67/67 全绿。
- 本地规则整体 top-1 **96.5%**，目标集合完全命中 **93.0%**，micro F1 **0.958**，兜底率 **19.8%**，禁用目标 **0** 次。
- 剩余 3 条失败全部是“没有明确对象、应交给分类模型”的样本：
  `model-who-door`、`model-fuse`、`model-night`。
- 本次同时补了四个局部规则：`阿明，你怎么看`（本人被点名）、`你俩`（复数）、
  `林晚🙂 你怎么看`（emoji 分隔）、`我不是问周野，我是问林晚`（否定语境）。
  这些规则由 `test/qa-router.test.js` 固定，避免以后改 prompt 时回归。

## 指标

| 指标 | 本地规则 |
|---|---:|
| 样本 | 86 |
| 确定性样本 | 67 |
| top-1 | 96.5% |
| 完全命中 | 93.0% |
| micro P / R / F1 | 0.962 / 0.953 / 0.958 |
| 兜底率 | 19.8% |
| 禁用目标 | 0 |
| 延迟 P50 / P95 | 0 ms / 1 ms |
| token | 0（未调用模型） |

按标签看，`ambiguous` 只有 62.5% top-1，是模型最该补的部分；`at`、`continuation`、
`direct`、`plural`、`emoji`、`long` 均 100%。完整表见基线报告。

## 真实模型怎么跑

```bash
cd multi-role-groupchat
GROUPCHAT_QA_API_KEY=... node qa/router/run.mjs --mode hybrid \
  --out qa/reports/router-hybrid.md --json qa/reports/router-hybrid.json
GROUPCHAT_QA_API_KEY=... node qa/router/run.mjs --mode model \
  --out qa/reports/router-model.md
```

建议门槛：

```bash
GROUPCHAT_QA_API_KEY=... node qa/router/run.mjs --mode hybrid --strict \
  --min-top1=0.85 --min-f1=0.85 --max-fallback=0.10
```

本次没有可用的 API key，因此没有把 hybrid/model 数字写成结论。报告必须带模型名、
日期和模式；不要把 key 写进文档。

## 观察

1. 纯本地规则已经能覆盖大多数中文对话形状；模型只该处理真正模糊的 10–20%。
2. 第三人称与否定是最容易误伤的两类，fixture 用 `forbidden` 单独盯住。
3. `maxMentionReplies` 在 3 人群默认 2 时，复数消息只让前两位必答；评测把上限放开到 3，
   以免把“产品截断”误算成“路由错误”。截断行为由单元测试单独覆盖。
4. 分类 prompt 仍只发公开档案和最近对话；新增的 `style`/记忆字段不进入路由器。
