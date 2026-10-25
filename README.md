# DSH Plugins

DeepSeek Harness Web GUI 插件集合。每个插件占一个独立文件夹，拥有自己的
`package.json`、`README.md`、`.gitignore` 和测试。

## 插件

### [多角色群聊 · Multi-role Group Chat](./multi-role-groupchat)

你是群主，2–3 个 AI 成员在同一个群里聊天。消息默认全群可见，可用 `@名字`
互相接话；支持停住/轮转、钉住、重写最新一条、token 预算、头像设置、
Markdown 导出和重启恢复。

- 面板入口：左侧栏「群聊」
- 管理入口：面板右上「管理」；设置 →「群聊」
- 文档：[multi-role-groupchat/README.md](./multi-role-groupchat/README.md)
- 安装：在 Harness 中执行

```text
plugin_manager action=install_bundle target=<本仓库路径>/multi-role-groupchat
```

安装后刷新 Web 页面。

## 约定

- 一个插件一个文件夹，互不共享源码。
- 运行数据不进入 Git；默认写入 `$DSH_HOME/plugin-data/`。
- 每个插件目录自带 `.gitignore`，克隆整个仓库即可分别开发、发布。
- 测试：进入插件目录执行 `npm test`。

## 计划书

- [多角色互聊插件-计划书-1.0.md](./多角色互聊插件-计划书-1.0.md)
