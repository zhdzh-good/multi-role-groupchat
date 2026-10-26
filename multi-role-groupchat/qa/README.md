# QA · 路由与角色贴合度

这里放**可重复、可回归**的评测，不参与插件运行时打包。

- 路由：86 条中文消息，比较本地规则 / 混合 / 纯模型三种策略
- 角色：25 个场景 / 29 条回应，检查秘密泄露、长度、代演、期望词与漂移
- 概率：固定种子扫描 `bystanderChance` 与 `maxMentionReplies`，给出按群规模的建议

## 命令

```bash
cd multi-role-groupchat

# 免费、确定性，CI 可跑
npm test
node qa/router/run.mjs --mode local --out qa/reports/router-local.md
node qa/roleplay/run.mjs --dry-run --out qa/reports/roleplay-dry-run.md
node qa/router/sweep.mjs --out qa/reports/router-sweep.md

# 需要真实模型与 key；不会自动进 CI
GROUPCHAT_QA_API_KEY=... node qa/router/run.mjs --mode hybrid --out qa/reports/router-hybrid.md
GROUPCHAT_QA_API_KEY=... node qa/router/run.mjs --mode model --out qa/reports/router-model.md
GROUPCHAT_QA_API_KEY=... node qa/roleplay/run.mjs --model deepseek-chat --out qa/reports/roleplay-model.md
```

也可以直接用 npm scripts：`npm run qa:router`、`npm run qa:roleplay:dry`、`npm run qa:sweep`。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `GROUPCHAT_QA_API_KEY` | 空 | 真实模型必填；也兼容 `DEEPSEEK_API_KEY` |
| `GROUPCHAT_QA_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI-compatible 接口 |
| `GROUPCHAT_QA_MODEL` | `deepseek-chat` | 也可用 `--model` |
| `GROUPCHAT_QA_TIMEOUT_MS` | `90000` | 单次请求超时 |

key 只从环境读取，不写入报告、日志或 JSON。真实运行会产生费用。

## 路由集

`qa/router/cases.json` 用共享 world + 短历史描述一条消息应该交给谁：

```json
{
  "id": "direct-emoji",
  "world": "bookshop",
  "history": [{ "speaker": "周野", "text": "线路我看过了。" }],
  "text": "林晚🙂 你怎么看",
  "targets": ["林晚"],
  "forbidden": ["周野"],
  "deterministic": true,
  "tags": ["direct", "emoji"]
}
```

- `targets`：应被回复的成员；空数组 + `ownerOnly` 表示只对本人说
- `forbidden`：不允许被选中的成员，用于第三人称/否定/指代回归
- `deterministic`：本地规则应直接命中，不调用模型
- `tags`：报告按标签拆 top-1 / F1 / 兜底率

新增样本后至少跑：

```bash
node --test test/qa-router.test.js
node qa/router/run.mjs --mode local
```

本地确定性样本必须全绿；模糊样本允许本地规则失败，它们用于真实模型对比。

## 指标

- **top-1**：预测的第一个目标是否等于标注的第一个目标
- **exact**：目标集合完全一致（顺序不计）
- **micro P / R / F1**：全样本汇总
- **fallback**：本地轮转兜底占比
- **禁用目标**：`forbidden` 被选中的次数
- **token / 延迟**：P50 / P95；分类调用计入 token
- **按标签**：定位哪类说法最差

`--strict` 可设门槛：

```bash
node qa/router/run.mjs --mode hybrid --strict \
  --min-top1=0.85 --min-f1=0.85 --max-fallback=0.10
```

## 角色集

`qa/roleplay/scenarios.json` 包含 world（群、owner、成员核心/秘密/关系）、开场、逐轮用户消息与目标成员。每轮 `expect`：

- `terms`：应该出现的词，按比例评分
- `voice`：称呼/语气标记
- `avoid`：出戏、AI 自述、承诺等禁用词
- `secrets`：成员核心里的秘密原文；出现在输出即泄露
- `maxChars`：长度上限

`--dry-run` 只构建 prompt，检查：

- system 前缀是否跨轮 byte-identical
- system 是否泄露任何成员秘密
- tail 是否包含角色核心、关系、最近发言、场景、任务、提醒
- 历史是否随轮次增长

真实运行还会检查：秘密泄露、超长、禁用词、以他人名字开头（代演）、期望词不足。角色感/相关性/出戏仍由人工在报告末尾的评分表填写。

## 漂移

`qa/lib/style.mjs` 对同一角色的回复做长度、问句率、短句率、称呼词的指纹；`bookshop-drift` 有 4 轮，报告会给出 early/late 漂移分。它只用于评审提示，不替代人工判断。

## 概率扫描

`qa/router/sweep.mjs` 固定种子模拟 5,000 轮/格，输出 2/3 人群在 0–100% 概率、1–3 个目标下的平均发言人数、全员发言率与 P95。当前建议：

- 2 人群默认 30%：平均 1.66 人/轮
- 3 人群默认 30%：平均 1.94 人/轮
- 想更热闹可试 40–50%，但全员发言率明显上升

## 约束

- 不把真实聊天记录或真实秘密放进 fixture；全部使用合成场景
- 不在 CI 里跑真实模型；CI 只跑 `npm test`
- 报告里的 key、provider 原始错误会被截断；不要把 `.env` 提交
- 模型评测结果受 provider、模型版本、温度影响，报告必须带模型名与日期
