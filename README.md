# multi-role-groupchat

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 的
**多角色群聊插件**：你以一个角色加入群聊，和 2–3 个 AI 成员在同一个群里聊天。消息默认全群可见，
谁都可以用 `@名字` 把话交给别人。

> 当前版本：**v1.2.0** · [插件详细文档](./multi-role-groupchat/README.md) · [Roadmap](./ROADMAP.md)

## v1.1 更新：智能路由

没有 `@` 时，插件不再一律让全群轮流回答，而是先判断“这句话是在对谁说”：

1. 显式 `@`、直接点名（如「林晚，你怎么看」）
2. 「你们 / 大家 / 各位」→ 所有成员
3. 「你 / 您」→ 最近发言的成员
4. 「嗯 / 继续 / 然后呢 / ？ / 在吗」→ 最近发言的成员
5. 仍然模糊时，调用一次小型分类模型，参考最近 8 条对话和成员公开档案
6. 分类失败或没有结果 → 本地轮转选一个兜底发言人

路由目标会先回答；其余每位成员按概率决定是否接话，默认 **30%**，可在
「管理 → 群设置 → 接话与路由」调到 **0–100%**。初始接话结束后只沿显式 `@`
接话链继续，不再强制全群轮转。

分类调用只发送群简介、成员公开一句话和最近对话，**不发送成员核心设定/秘密**；
其 token 会计入群预算，并写入 `route` 事件。

## v1.2 更新：角色与群配置导入导出

- **整群备份**：导出群名、简介、我的角色、成员设定、接话规则、预算与模型覆盖为 JSON；不包含消息、钉住和导出历史
- **整群导入**：导入前显示群名、成员、路由参数、文件大小与校验提示；确认后创建为一个新群，使用新的群/成员 ID
- **角色卡**：成员和「我的角色」都可以单独导出/导入 JSON；导入只填充表单，保存前仍走正常校验
- **关系可迁移**：导出时不写本地 ID，关系按成员名字保存；导入新群时自动映射到新 ID
- **头像可选**：导出群配置时可以关闭头像，显著减小文件；仍支持现有 128×128 PNG data URL
- **安全校验**：成员 2–3 人、重名、字段长度、头像格式/大小、文件 4 MB 上限、未知关系与旧版本都会在预览中提示

当前只支持 JSON；YAML 留作后续可选项。

## 功能

- 智能路由：没有 `@` 时也能判断对谁说；目标必答，其余成员按概率接话
- 角色卡 / 群配置 JSON 导入导出：关系按名字迁移，头像可选，导入前预览
- 我的角色档案（默认名「用户」，可改名）、群聊面板、成员设定、群级/成员级模型覆盖
- `@` 路由、显式接话链、`@角色名` 交还控制（旧 `@群主` 兼容）、接话跳数上限
- 智能路由开关、概率接话、最多目标数等群级设置
- 钉住、折叠早期消息、重写最新一条、token 预算、Markdown 导出
- 删除群聊（输入群名确认，永久移除该群数据）
- 头像设置、追加式事件日志、重启恢复
- 67 项确定性测试，含随机稳定性压测

## 仓库结构

```text
multi-role-groupchat/   插件本体（package.json、Host/Client、测试）
多角色互聊插件-计划书-1.0.md   设计文档
LICENSE                MIT
```

每个插件一个独立文件夹；插件目录自带 `.gitignore`、`README.md` 与测试。

## 安装

从源码安装（当前通过本地 bundle 安装，未发布到 npm）：

```bash
git clone https://github.com/zhdzh-good/multi-role-groupchat.git
```

在 Harness 中执行：

```text
plugin_manager action=install_bundle target=<仓库路径>/multi-role-groupchat
```

安装或升级后刷新 Web 页面，左侧栏出现「群聊」。数据保存在
`$DSH_HOME/plugin-data/multi-role-groupchat/`，重新安装插件不会删除群聊数据。

## 开发

```bash
cd multi-role-groupchat
npm test
node --check client.js
```

详细的协议、数据格式、稳定性测试与已知限制见
[插件 README](./multi-role-groupchat/README.md)。

## Roadmap

后续任务、优先级与验收标准见 [ROADMAP.md](./ROADMAP.md)。

## License

MIT © 2026 [zhdzh-good](https://github.com/zhdzh-good)
