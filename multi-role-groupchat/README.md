# 多角色群聊 · Multi-role Group Chat

一个 DeepSeek Harness Web GUI 插件：**你是群主，2–3 个 AI 成员在同一个群里聊天**。消息默认全群可见；任何成员都可以用 `@名字` 把话交给别人，`@群主` 表示交还控制。

按《多角色互聊插件-计划书-1.0》实现，覆盖 M0 + M1：

- 群 + 2–3 成员、公开档案、核心 / 扩展设定、成员模型覆盖
- 发送 / 流式回应 / `@` 路由 / 轮转接话 / 接话跳数上限
- `@群主` 立即停止、预算不足暂停并写入提示
- 钉住（始终进入 prompt）、折叠早期消息、重写最新一条
- token 统计（输入 / 输出 / 缓存读 / 缓存写）、群级累计预算
- Markdown 导出（发言人、时间、轮次、token 汇总，可选历史版本）
- 追加式 `events.jsonl`，重启后重放恢复

## 入口

| 位置 | 内容 |
|---|---|
| 左侧栏 · 群聊图标 | 主群聊面板 |
| 主面板 ·「管理」 | 群设置 / 成员编辑 / 导出（右侧抽屉） |
| 设置 ·「群聊」 | 群列表、新建群、群设置与成员编辑 |
| 设置 · 插件 | 插件标题、描述与图标 |

`main` 面板的 key 与 `sidebar.panellist` 的 id 都是 `groupchat`；设置页注册在 `settings.section`。

## 数据

默认目录：`$DSH_HOME/plugin-data/multi-role-groupchat/groups/<gid>/`

```text
group.json
members/<cid>/card.json
members/<cid>/setting/core.md
members/<cid>/setting/extended.md
events.jsonl
export/script.md
```

- `events.jsonl` 追加写：`message` / `supersede` / `pin` / `notice`。
- 启动或首次打开时重放事件；末尾不完整行丢弃并在界面提示。
- `group.json` / `card.json` 带 `schemaVersion: 1`；遇到更高版本会拒绝读取并提示迁移，不静默覆盖。
- 删除插件数据 = 删除该目录；插件不会修改 Harness 的会话日志。

## 协议要点

- 提及解析：`/@([^\s@，。！？、,.!?:：;；]{1,16})/g`，与成员显示名或 `群主` **精确**匹配；未知 `@` 只当文本，不改路由。
- 生成上限：有提及时 `min(被 @ 人数, maxMentionReplies) + maxHandoffDepth`；无提及时 `min(3, maxHandoffDepth + 1)`。与计划书 §3.2 表一致。
- 轮转：排除上一位发言人，`lastSpokeAt` 升序，同时间按 id 字典序。
- prompt：稳定 system 前缀（群简介 + 公开档案 + 规则）→ 历史（钉住优先，再取最近 `maxHistory` 条）→ 每轮尾部块（扮演成员、核心/扩展设定、本次回应提示）。前缀不含时间戳、轮次号或随机 id。
- 重写：只对最新一条有效成员消息开放；先成功生成新版本，再追加 `message(supersedes)` + `supersede`，旧版本只留在日志里。
- 预算：按群累计 usage 判断；达到输入或输出上限时停止，写入 `notice`，不自动续。

## 开发

```bash
cd multi-role-groupchat
npm test                    # 32 个确定性测试（协议、编排、存储、路由、稳定性）
node --check client.js      # 浏览器模块语法
```

稳定性压测默认 80 轮随机对话；可以调参跑更久：

```bash
GROUPCHAT_STRESS_TURNS=500 \
GROUPCHAT_STRESS_SEED=20251025 \
GROUPCHAT_STRESS_DEPTH=2 \
GROUPCHAT_STRESS_MENTIONS=2 \
node --test --test-name-pattern=randomized test/stability.test.js
```

已跑过 500 轮 + 4 组不同深度/提及上限/种子的 300 轮组合，检查：生成次数上限、接话不连续同人、`replyIndex` 连续、`replyTo` 链、`@群主` 即停、钉住上限、折叠计数、token 累计、JSONL 唯一性、每 10 轮重启重放一致、并发发送 409、单群停止不影响其他群、200 条消息重放与截断行恢复。

测试覆盖：`@` 精确匹配 / 未知忽略 / 自我忽略、生成上限、轮转与排除上一位、历史折叠与钉住、事件重放、重写、预算暂停、存储重载与截断行、HTTP 路由与 NDJSON 流。

安装（在 Harness 里）：

```text
plugin_manager action=install_bundle target=/home/zqy/桌面/plugin/multi-role-groupchat
```

安装后刷新 Web 页面；左侧栏出现「群聊」。

## 已知限制

- 头像在「管理 → 成员」里上传 PNG / JPEG / WebP，客户端裁成 128×128 PNG 后以 data URL 存入 `card.json`；未设置时显示首字色块。
- 成员最多 3 个；首版不提供移除成员 / 删除群，避免误删设定与历史。
- 「停止」保留已生成的部分在界面上，但不写入有效消息；重新加载后只看到已完成的回复。
- 重写只替换目标那一条，不继续触发接话链。
- 预算按 provider 返回的 usage 累计；不同 provider 的缓存字段口径可能不同。
- 钉住的消息会按计划书移到 prompt 前部，因此“钉住一条旧消息”会改变此前的缓存前缀；未钉住的线性对话前缀保持稳定。
- 多标签页之间没有实时推送；面板重新挂载或生成中轮询时同步。切换面板不会中断进行中的生成，但关闭页面会中断。
- 浏览器端的视觉与交互（主题、深浅色、窄屏）已按宿主 token 编写，但本环境无法截图验证；交付时只声明静态与 Host/Client 接线验证结果。
