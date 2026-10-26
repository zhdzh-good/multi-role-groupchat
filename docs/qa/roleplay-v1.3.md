# 角色贴合度 QA · 2026-10-26

> 数据集：`multi-role-groupchat/qa/roleplay/scenarios.json`
> 运行器：`qa/roleplay/run.mjs`
> dry-run 报告：`qa/reports/roleplay-dry-run.md`

## 结论

- 已建 **25 个场景 / 29 条回应**，覆盖日常、秘密、追问、关系、冲突、工作、语言混用。
- 每个成员都有公开一句话、核心设定、秘密、底线；6 个 world 共 16 个角色。
- `--dry-run` 检查通过：
  - system 前缀在同一场景跨轮 **byte-identical**；
  - system 不含任何成员秘密；
  - 每个 tail 都包含「角色核心 / 你与在场者的关系 / 本场状态 / 本轮任务 / 角色提醒」；
  - 最新消息、历史条数、tail 长度符合预期。
- 真实模型生成与人工评分尚未执行：本次没有 API key，不伪造角色感/相关性数字。

## 本次 prompt 分层

```
system（稳定缓存前缀）
  群简介 + 我的角色 + 成员公开档案 + 规则

tail（每个成员 / 每轮变化）
  角色核心
  扩展背景（可选）
  说话方式（可选，style）
  你与在场者的关系
  你最近说过
  只有你知道（memory）
  你私下的关系（privateRelations）
  本场状态
  本轮任务（addressed / bystander / handoff）
  角色提醒
```

`style`、`memory` 与 `privateRelations` 已接入成员卡、管理页和群/角色卡导入导出；
`memory` 写入 `setting/memory.md`，`privateRelations` 写入 `card.json`。
私有字段只进入本人 prompt；system 前缀、路由器和其他成员的 tail 都有隔离测试。
导出默认不含私有字段，只有显式勾选才写入 `.private.` 文件。

## 真实模型怎么跑

```bash
cd multi-role-groupchat
GROUPCHAT_QA_API_KEY=... node qa/roleplay/run.mjs \
  --model deepseek-chat --out qa/reports/roleplay-model.md \
  --json qa/reports/roleplay-model.json
```

跑完在报告末尾的人工评分表填：

- 角色感 /5：称呼、句长、立场、底线是否稳定
- 相关性 /5：是否直接回应用户，而不是自说自话
- 出戏：是否出现 AI 自述、总结规则、替别人说话

自动检查只抓客观项：秘密泄露、超长、禁用词、以他人名字开头、期望词不足。

## 漂移

`bookshop-drift` 有 4 轮同一角色。`qa/lib/style.mjs` 比较前两轮与后两轮的：

- 平均长度
- 问句率
- 短句率
- 称呼词重叠

输出 0–1 的漂移分；它只是评审提示，不替代人工判断。真实运行后该场景会出现在报告里。

## 下一步

1. 有 key 后先跑 `deepseek-chat` 基线，再跑第二个模型，记录角色感、相关性、延迟、token。
2. 如果“没干透/欠人情/账本”这类秘密被泄露，优先改 tail 的角色提醒，不要堆全局规则。
3. 如果长对话漂移明显，下一步应让 `memory` 的维护更省力（例如手动摘要模板），而不是让它进入共享 prompt。
4. 人工评分至少两人各评一遍，报告保留原始输出，避免只留平均分。
