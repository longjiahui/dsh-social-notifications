# dsh-social-notifications

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的会话状态通知插件：把各个工作区里 Session 的状态变化实时推送到通知提供方。内置「企业微信群机器人 Webhook」提供方，实例在 **设置 → 通知** 面板中可视化增删改查。

## 功能

- **通知事件（6 种，可按实例开关）**：
  - 新会话
  - 开始运行
  - 运行完成
  - 运行出错
  - 等待确认/输入 —— 工具权限确认、agent 提问、计划评审（Plan review）等阻塞状态（30 秒内同类阻塞合并为一条，防刷屏）
- **多实例**：可同时配置多个 Webhook，推送到多个群；每个实例独立启用/停用、独立事件开关。
- **Provider 结构可扩展**：`senders` 注册表按 `type` 分发，当前实现 `wecom`（企业微信群机器人）；后续可扩展飞书 / Telegram / Discord 等。
- **发送测试通知**：一键验证 Webhook URL，返回每个实例的投递结果。
- 限流保护：每实例 60 秒最多 15 条（企业微信群机器人上限 20/分钟）。

## 安装

### 方式一：Plugin Market（推荐）

1. 在 Plugins 页安装官方实验性市场包 `@deepseek-ai/dsh-experimental-plugin-market-bundle`；
2. 在 Discover 标签里把市场源设置为：
   ```
   https://raw.githubusercontent.com/longjiahui/dsh-social-notifications/main/index.json
   ```
3. 找到 Notifications 并安装。

### 方式二：手动安装

```bash
dsh plugin install https://github.com/longjiahui/dsh-social-notifications.git
```

安装后刷新页面，设置面板会出现「通知」标签。

## 配置

1. 在企业微信群里添加群机器人，复制其 Webhook 地址；
2. 打开 **设置 → 通知 → 添加通知**；
3. 填写 Webhook URL，按需勾选事件，保存；
4. 点击「发送测试通知」验证群里收到消息。

> **隐私说明**：Webhook URL 保存在你本机的 profile 配置中（`~/.dsh/profiles/<profile>/cordis.patch.yml`），不会上传到任何地方；本仓库源码不含任何密钥或隐私数据。

## 结构

```
index.js          Host 半：事件监听、provider 发送器、测试路由
client.js         浏览器半：设置面板「通知」页（实例 CRUD）
cordis.patch.yml  Loader 补丁（插入 notifications 条目）
icon.svg          图标
locale/           界面文案（zh / en）
```

## License

[MIT](LICENSE)
