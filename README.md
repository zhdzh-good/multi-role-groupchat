# multi-role-groupchat

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 的
**多角色群聊插件**：你是群主，2–3 个 AI 成员在同一个群里聊天。消息默认全群可见，
谁都可以用 `@名字` 把话交给别人。

- 群聊面板、成员设定、群级/成员级模型覆盖
- `@` 路由、轮转接话、`@群主` 交还控制、接话跳数上限
- 钉住、折叠早期消息、重写最新一条、token 预算、Markdown 导出
- 头像设置、追加式事件日志、重启恢复
- 32 项确定性测试，含 1000 轮随机稳定性压测

## 仓库结构

```text
multi-role-groupchat/   插件本体（package.json、Host/Client、测试）
多角色互聊插件-计划书-1.0.md   设计文档
LICENSE                MIT
```

每个插件一个独立文件夹；插件目录自带 `.gitignore`、`README.md` 与测试。

## 安装

在 Harness 中执行：

```text
plugin_manager action=install_bundle target=<本仓库路径>/multi-role-groupchat
```

安装后刷新 Web 页面，左侧栏出现「群聊」。

## 开发

```bash
cd multi-role-groupchat
npm test
node --check client.js
```

详细的实现、数据格式、稳定性测试与已知限制见
[插件 README](./multi-role-groupchat/README.md)。

## Roadmap

后续任务、优先级与验收标准见 [ROADMAP.md](./ROADMAP.md)。

## License

MIT © 2026 [zhdzh-good](https://github.com/zhdzh-good)
