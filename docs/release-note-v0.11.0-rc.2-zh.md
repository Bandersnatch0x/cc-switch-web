# cc-switch-web v0.11.0-rc.2

> 面向 Web/headless 本地代理启动与客户端接管体验的预发布修复版本

**[English Version ->](release-note-v0.11.0-rc.2-en.md)**

---

## 概览

`v0.11.0-rc.2` 基于 `v0.11.0-rc.1`，重点修复真实服务器测试中发现的本地代理与应用接管交互问题。

这仍然是预发布版本。本地代理在接管时会修改真实客户端配置文件，因此在稳定版 `0.11.0` 前仍建议继续按 RC 版本验证。

---

## 修复

- 防止快速切换接管开关时重复发起代理接管请求。
- 接管请求执行中禁用接管开关，避免连点造成重复状态变更。
- 为接管成功提示使用固定 toast ID，避免重复堆叠。
- 为代理启动、停止、恢复、接管成功提示设置较短的明确显示时间，避免重复操作后提示堆叠或看起来消不掉。
- 当前进程内代理已经运行时，再次启动会刷新状态并显示友好的“代理已在运行”提示，不再重复绑定同一 host/port。
- 当代理端口被其他进程占用时，显示更清楚的用户可读错误。
- 修复代理接管目标列表中 Claude 可能重复出现的问题。
- 流式请求首字节超时且尚未发送响应 body 时，允许尝试 failover。

---

## 体验调整

- 明确“应用接管”表示 cc-switch-web 会临时修改本地客户端配置。
- 明确“默认绑定客户端”只是代理无法判断请求归属时的 fallback。
- 增加每个客户端的独立代理测试按钮，例如“测试 Claude”“测试 Codex”。
- 将默认首字节超时从 30 秒提高到 90 秒，更适合真实 upstream 环境。

---

## 验证

本版本已通过：

- `pnpm typecheck`
- `pnpm exec vitest run tests/components/ProxySettingsSection.test.tsx tests/hooks/useSettingsForm.test.tsx tests/lib/api/settings.test.ts`
- `pnpm exec vitest run`
- `cargo test --features web-server --test proxy_web_api --manifest-path src-tauri/Cargo.toml`
- `cargo test --features web-server --lib proxy:: --manifest-path src-tauri/Cargo.toml`
- `cargo check --no-default-features --features web-server --lib --manifest-path src-tauri/Cargo.toml`
- `cargo check --no-default-features --features web-server --example server --manifest-path src-tauri/Cargo.toml`

---

## 已知边界

- 本地代理是应用内 HTTP API proxy，不是系统透明代理。
- 不修改 OS 全局代理设置。
- 暂不支持 PAC / Clash rule。
- OpenCode 接管仍为实验性能力。
- Gemini OAuth provider 明确不支持接管；测试 Gemini 接管请使用 API Key provider。
- 多 provider failover 队列、circuit breaker UI、跨 provider 请求/流式格式转换会放到后续版本。
