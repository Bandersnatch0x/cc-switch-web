# Proxy 后续能力产品设计决策

本文对照 cc-switch 现有实现，明确 proxy 后续能力的产品语义。目标是让 proxy 扩展继续沿用当前项目的设计原则，而不是引入另一套独立规则。

## 现有实现给出的产品原则

1. **当前 provider 是事实来源**

   `MultiAppConfig` 为每个 app 保存 `current` 和 `providers`，provider 切换会持久化当前 provider，并把当前 provider 投影到对应客户端 live config。参考：

   - `src-tauri/src/provider.rs`
   - `src-tauri/src/services/provider.rs`

2. **live config 是投影，不是主存储**

   provider 切换会写 live config；如果写入失败，`ProviderService::run_transaction` 会回滚配置和 live snapshot。这个模式说明：任何会改变真实使用 provider 的动作，都应该走可回滚、可解释的服务层，而不是只改 runtime 临时状态。

3. **proxy takeover 激活时，provider 切换仍然切 current，但不改 live config**

   `ProviderService::apply_post_commit` 在 proxy takeover 已启用时跳过 live config 写入。也就是说 takeover 下的 provider 切换语义是：

   - `current provider` 仍然变化并持久化。
   - live config 保持 `PROXY_MANAGED`。
   - 下一次 CLI 请求由 proxy 使用新的 current provider。

4. **自动 failover 已有语义是“切换到备用 provider”**

   前端 `App.tsx` 已经基于 `backupCurrent` 和健康检查实现自动故障切换：当 current 不健康、backup 健康时，调用正常的 `switchProvider`，也就是把 backup 真正切成 current。

5. **安全优先于便利**

   现有 proxy 默认监听 `127.0.0.1`，`0.0.0.0` 会提示风险；live takeover 有 backup/restore；stop 会 restore live config 并清空 takeover flags；`proxy-backups.json` 不给前端展示。后续功能继续遵守这个方向。

6. **敏感信息不进 UI、不进日志**

   provider API key、Authorization、请求/响应 body、proxy backup 都应视为敏感信息。已有 UI 也只展示 provider name，不展示 key。

## 1. Recent Logs Ring Buffer

### 产品决策

实现内存态 recent logs，不落盘，不写入 `config.json`，不写入 `proxy-backups.json`。

`enableLogging` 的语义定义为：

> 是否记录最近 proxy 请求摘要。

因此：

- `enableLogging = false` 时不记录日志。
- 关闭 `enableLogging` 时清空已有 ring buffer。
- `GET /api/proxy/logs/recent` 在 `enableLogging = false` 时返回空数组。
- `start_proxy` 时重置本次 runtime 的 logs，和现有 stats 在 start 时重置保持一致。
- `stop/restore/recover` 时也清空 logs，符合“停止代理 = 恢复安全状态”的现有语义。

### 数据结构

```rust
struct ProxyRecentLog {
    at: DateTime<Utc>,
    app: String,
    method: String,
    path: String,
    status: Option<u16>,
    duration_ms: u64,
    error: Option<String>,
}
```

默认最多 100 条，使用内存 ring buffer。后续如果要允许配置数量，再加 `recentLogLimit`，但默认仍限制在 100。

### 脱敏规则

绝不记录：

- `Authorization`
- `Proxy-Authorization`
- `x-api-key`
- `x-goog-api-key`
- `api-key`
- request body
- response body
- provider settings
- provider token/base config

`path` 只记录路径和脱敏后的 query。敏感 query key 统一替换为 `***`：

- `key`
- `api_key`
- `apikey`
- `access_token`
- `token`
- `auth`
- `authorization`
- `client_secret`
- `refresh_token`
- `id_token`

query value 最大保留长度也应限制，避免日志被超长 URL 撑爆。建议单条 log 序列化后限制在 4KB 内，超出截断。

### API

- `GET /api/proxy/logs/recent`
- Tauri command: `proxy_recent_logs`

返回：

```json
[
  {
    "at": "2026-05-07T08:00:00Z",
    "app": "gemini",
    "method": "POST",
    "path": "/v1beta/models/gemini:generateContent?key=***",
    "status": 200,
    "durationMs": 123,
    "error": null
  }
]
```

### UI

在 `ProxySettingsSection` 里加一个 compact recent logs 区域，仅显示摘要。默认折叠，不自动展示敏感路径细节。日志为空时只显示空态，不提示用户打开更多权限。

## 2. Streaming Passthrough 和 Timeout

### 产品决策

实现纯 streaming passthrough，不做协议格式转换。

这和当前 proxy adapter 设计一致：adapter 负责 base URL、auth header、path 归一化；不负责 Claude/OpenAI/Gemini 协议互转。

### 行为

1. 请求仍按当前 route 规则识别 app：

   - Claude: `/v1/messages`
   - Codex/OpenAI compatible: `/v1/chat/completions`, `/v1/responses`, `/chat/completions`, `/responses`
   - Gemini: `/v1beta/*`, `/gemini/*`
   - 其他走 `bindApp`

2. upstream response 不再统一 `.bytes().await` 聚合。

3. 对 streaming response：

   - 原样透传 status。
   - 原样透传非 hop-by-hop response headers。
   - 原样透传 chunk bytes。
   - 不解析 SSE event。
   - 不改 event name。
   - 不改 data payload。
   - 不做 Claude/OpenAI/Gemini event 格式转换。

4. 对 non-streaming response：

   - 可继续用总超时 `nonStreamingTimeout`。
   - 可继续聚合 body，便于保持现有错误处理和测试。

### streaming 判定

优先基于 upstream response headers 判定：

- `content-type` 包含 `text/event-stream`
- 或 `transfer-encoding: chunked`
- 或请求 header 明确 `accept: text/event-stream`

如果无法确定，默认按 non-streaming 处理。这样更贴近当前“保守代理”的设计。

### timeout 语义

- `streamingFirstByteTimeout`: 从 upstream response headers 之后，到第一个 body chunk 到达的最大等待时间。
- `streamingIdleTimeout`: 任意两个 body chunk 之间的最大等待时间。
- `nonStreamingTimeout`: non-streaming request 的总超时。

streaming request 不使用 reqwest client 总 timeout 覆盖整个流，否则长时间有效 SSE 会被误杀。streaming 只使用 connect timeout、first byte timeout、idle timeout。

### 错误语义

- upstream 还没返回 headers 就失败：返回 `502` JSON error。
- headers 已返回、stream 中途失败：终止 stream，并记录 recent log / stats error；不尝试格式化错误 body。
- client disconnect：停止读取 upstream，不计为 provider failure。
- streaming 已经输出第一个 chunk 后失败：不重试，不 failover。否则可能重复扣费或制造重复响应。

## 3. Failover / Circuit Breaker

### 产品决策

沿用 cc-switch 现有自动 failover 语义：

> failover 成功后，真正把 backup provider 切换为 current provider，并持久化。

不设计一套只在 proxy runtime 内临时使用的“隐形 provider”。理由：

- 现有前端自动 failover 已经是 `switchProvider`。
- 用户看到的 current provider 应该和实际使用 provider 一致。
- provider 切换已有事务、live snapshot、MCP 同步、proxy takeover 跳过 live 写入等安全路径。

### 初始范围

先做单 backup provider，不做多 provider queue。

配置来源：

- `ProviderManager.backup_current`
- `ProxySettings.apps.<app>.autoFailoverEnabled`
- `ProxySettings.apps.<app>.maxRetries`

`maxRetries = 0` 表示不自动重试、不自动 failover。

### 运行时状态

provider health/circuit breaker 状态先只放内存，不落盘：

```json
{
  "proxyRuntimeHealth": {
    "claude": {
      "provider-a": {
        "state": "healthy",
        "failureCount": 0,
        "lastFailureAt": null,
        "openedAt": null
      }
    }
  }
}
```

不写入 `config.json`。原因是 cc-switch 当前 provider health 来源是外部健康检查和 UI cache，不是持久化状态；proxy runtime health 也应是运行期状态。

### 状态机

- `healthy`
- `open`
- `halfOpen`

建议默认：

- 同一 provider 连续失败 `max(2, maxRetries + 1)` 次后进入 `open`。
- `open` 60 秒后进入 `halfOpen`。
- `halfOpen` 一次成功恢复 `healthy`。
- `halfOpen` 一次失败回到 `open`。

这些参数先不做 UI 配置，避免 UI 复杂化。后续再根据使用反馈外露。

### 可 failover 错误

允许 failover：

- DNS/connect/TLS 错误
- upstream request timeout
- streaming first byte timeout，且没有发送任何响应给客户端
- HTTP `429`
- HTTP `5xx`

不允许 failover：

- HTTP `400/401/403/404`
- request body 读取失败
- client disconnect
- streaming 已经向客户端输出任何 chunk 后的错误
- adapter/build URL/auth extraction 的本地配置错误

### 成功后的动作

当 backup provider 成功响应后：

1. 调用 provider switch 逻辑，把 backup 切成 current。
2. proxy takeover active 时，现有 provider service 不会重写 live config，符合当前设计。
3. 记录 recent log：`failoverFrom` / `failoverTo` 可作为未来字段，但不能记录 token。
4. stats 增加 failover count。可加到 `ProxyStatus`：

```ts
failoverCount?: number
lastFailoverAt?: string
lastFailoverFrom?: string
lastFailoverTo?: string
```

provider id/name 可以展示，token/base URL 不展示。

### 多 provider queue

不在第一版实现。

后续如果做 queue，应该以现有 `backupCurrent` 作为 queue 的第一个来源，并在 UI 上明确“备用队列”。但第一版只用一个 backup，和 cc-switch 当前模型一致。

## 4. 高级协议格式转换

### 产品决策

默认不做高级格式转换。

理由：

- cc-switch 现有 provider 是按 app 隔离的：Claude provider、Codex provider、Gemini provider、OpenCode provider 各自有自己的配置结构。
- 当前 proxy adapter 只负责同协议/兼容协议下的 base URL、auth、path 转发。
- 隐式跨协议转换会让“当前 app provider”语义变得不透明，也更容易造成模型能力、流式 event、工具调用、thinking 字段不一致。

### 第一阶段行为

保持 native passthrough：

- Claude client 使用 Claude provider。
- Codex/OpenAI-compatible client 使用 Codex provider。
- Gemini client 使用 Gemini provider。
- OpenCode client 使用 OpenCode provider。

如果用户想让 Claude client 使用 OpenAI/Gemini provider，必须未来显式启用转换模式。不能默认偷偷转换。

### 未来转换模式设计

后续可新增实验性配置：

```ts
type ProxyConversionMode =
  | "native"
  | "claude-to-openai-chat"
  | "claude-to-openai-responses"
  | "claude-to-gemini";
```

建议挂在 app 层：

```json
{
  "proxy": {
    "apps": {
      "claude": {
        "conversionMode": "native"
      }
    }
  }
}
```

默认值永远是 `native`。

### 转换必须满足的最低要求

每个转换模式必须单独测试：

- request body schema 转换
- non-streaming response 转换
- SSE event 转换
- tool use / function call 转换
- system prompt / messages 转换
- thinking/budget 字段处理
- error response 转换
- token/key 不泄漏
- provider 不支持字段时的可解释错误

不允许只做 request 转换、不做 response 转换的半成品。

### UI

转换模式必须标为 experimental，并在 UI 中明确显示当前模式。不和基础 proxy start/stop/takeover 混在一起。

## 5. Stop 是否保留 takeover flags

### 产品决策

保持当前语义：

> 停止代理 = 停止 runtime + 恢复 live config + 清空 takeover flags。

这是当前实现的行为：`ProxyService::stop` 调用 `live::restore_all()`，`restore_all()` 会恢复所有 app live config，并把 `apps.*.enabled` 和 `liveTakeoverActive` 清空。

### 理由

- 和 cc-switch 的安全恢复原则一致。
- 用户按“停止代理”时，最安全的预期是客户端恢复原始配置，不再指向本地 proxy。
- 如果保留 takeover flags，下次 start 自动重新接管，会让“停止”看起来像“暂停”，容易误解。
- `proxy-backups.json` 可能含 token，越早 restore/清理越符合安全目标。

### 如果未来需要保留开关

不要改变 stop 语义。新增单独概念：

- `pause_proxy`: 停止 runtime，但保留期望 takeover 设置。
- `resume_proxy`: 启动 runtime，并按保留设置重新 takeover。

但这不是当前产品设计的一部分。

## 推荐实现顺序

1. Recent logs ring buffer + `/api/proxy/logs/recent`
2. Streaming passthrough + first byte / idle timeout
3. Proxy runtime failover using existing `backupCurrent`
4. Failover status fields and UI display
5. 高级协议转换实验性设计和测试矩阵

## 不变约束

- 不修改 OS 全局代理。
- 不支持 PAC / Clash rule。
- 不做透明代理。
- 不记录 Authorization/API key/request body/response body。
- 不把 `proxy-backups.json` 暴露给前端。
- OpenCode takeover 继续保持 experimental，直到官方配置行为和模型选择策略完全确认。
- Gemini OAuth takeover 继续拒绝，API key provider 才允许 takeover。
