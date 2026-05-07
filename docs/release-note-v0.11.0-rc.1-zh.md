# cc-switch-web v0.11.0-rc.1

> 面向 Web/headless 场景的代理能力与 OpenCode / OMO 体验修复预发布版本

**[English Version ->](release-note-v0.11.0-rc.1-en.md)**

---

## 概览

`v0.11.0-rc.1` 聚焦两个方向：修复用户在 Issues 中反馈的现有功能缺陷，并加入第一版本地 HTTP 转发代理能力，方便 Web/headless、Docker、远程服务器等场景通过 cc-switch-web 统一承接请求。

---

## 新增功能

### 本地 HTTP 代理与客户端接管

新增 Web/headless 模式下的本地代理服务，可通过当前选中的供应商配置自动转发请求，并可接管 Claude / Codex / Gemini / OpenCode 的 live config。

**核心能力**：

- **启动 / 停止 / 状态查看** - 在设置页直接控制代理运行状态，并显示请求数、成功率、运行时长和最近错误
- **代理配置持久化** - 保存监听地址、端口、上游代理、自动启动、日志开关、超时配置和每个客户端的接管开关
- **按当前供应商注入凭据** - 代理从对应客户端的当前 provider 中读取 base URL 与 API key，不在 UI 中明文展示密钥
- **多客户端同端口路由** - 同一个本地代理端口可识别 Claude、Codex / OpenAI、Gemini 的常见 API 路径；旧的 `bindApp` 保留为兜底兼容路由
- **Live config 接管与恢复** - 开启接管时备份原配置，写入本地代理地址和 `PROXY_MANAGED` placeholder；停止或恢复时还原原文件
- **热切换 provider** - 接管开启后，在 Web UI 切换 provider 不再重写 live config，下一次 CLI 请求会通过代理使用新的当前 provider
- **Web server 自动启动** - 当 `enabled` 和 `autoStart` 同时开启时，Web server 启动时自动尝试启动代理
- **最近请求摘要** - 可在设置页查看内存态最近请求摘要，敏感 query 参数会脱敏，关闭日志时不保留记录
- **流式透传** - 对 SSE / chunked upstream response 进行原样透传，并支持首字节与 idle 超时控制
- **单备用 failover** - 当当前 provider 出现连接/超时、429 或 5xx 时，可按 `backupCurrent` 自动切换到备用 provider，并真实持久化为 current provider

**新增 Web API**：

- `GET /api/proxy/status`
- `GET /api/proxy/config`
- `PUT /api/proxy/config`
- `PUT /api/proxy/settings`
- `POST /api/proxy/start`
- `POST /api/proxy/stop`
- `POST /api/proxy/test`
- `GET /api/proxy/logs/recent`
- `GET /api/proxy/takeover`
- `PUT /api/proxy/takeover/:app`
- `POST /api/proxy/restore`
- `POST /api/proxy/recover-stale-takeover`

**当前接管支持**：

- Claude：写入 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN=PROXY_MANAGED`，保留其他 env，并移除模型覆盖 env
- Codex：写入 placeholder `auth.json` 和指向本地代理 `/v1` 的 `config.toml`
- Gemini：支持 API key provider 接管；OAuth 官方 Gemini 第一版不做完整代理接管承诺
- OpenCode：提供实验性接管入口
- OMO：暂不支持代理接管

**安全默认值**：

- 默认监听 `127.0.0.1:3456`
- 配置 `0.0.0.0` 时，设置页会提示公开监听风险
- 不修改系统全局代理，不写 PAC，不实现 Clash rule
- 接管备份保存在 `~/.cc-switch/proxy-backups.json`，便于和普通设置分离

---

## 修复

### Claude provider JSON 格式化

修复编辑供应商弹窗中“格式化”导致 `env` 外层丢失的问题。

格式化前后都会保留完整结构：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "",
    "ANTHROPIC_BASE_URL": ""
  }
}
```

如果用户只粘贴 root-level 的 `ANTHROPIC_*` 环境变量片段，格式化时也会规范回 `{ "env": ... }`，避免保存成 Claude Code 无法识别的结构。

### Skills 安装路径

补充回归测试并确认 Anthropic 官方 `anthropics/skills` 仓库使用 `skills` 子目录扫描，不会安装到多嵌套路径。

覆盖路径：

- `~/.claude/skills/<skill-name>`
- `~/.codex/skills/<skill-name>`
- `~/.config/opencode/skills/<skill-name>`

明确防止：

- `~/.claude/skills/skills/<skill-name>`
- `~/.codex/skills/skills/<skill-name>`

### OpenCode / OMO 显示一致性

- 恢复 OMO 作为当前 Web UI 应用时的 MCP 与 Skills 管理入口
- OMO Skills 明确复用 OpenCode 的 `~/.config/opencode/skills`
- OMO provider 管理继续保持独立，MCP / Skills 按 OpenCode 共享配置模型处理
- 避免用户看到空白页面后误以为已有环境没有被识别

---

## 测试

本版本补充并通过以下验证：

- `pnpm typecheck`
- `pnpm exec vitest run tests/components/ProxySettingsSection.test.tsx tests/lib/api/settings.test.ts tests/lib/adapter.core.test.ts`
- `pnpm exec vitest run src/utils/formatters.test.ts`
- `cargo test --features web-server --test proxy_web_api --manifest-path src-tauri/Cargo.toml`
- `cargo test --features web-server --lib proxy:: --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib services::skill::tests`

---

## 已知边界

- 本地代理是应用内 HTTP API proxy，不是系统透明代理
- 暂不修改 OS 全局代理设置
- 暂不支持 PAC / Clash rule
- 暂不包含多 provider failover 队列与 token/cost 统计
- 暂不做 Claude 请求到 OpenAI / Gemini 的高级格式转换，也不做 SSE 事件格式转换
- OMO 暂不作为独立 Skills / MCP 存储源，仍复用 OpenCode 的共享配置模型
