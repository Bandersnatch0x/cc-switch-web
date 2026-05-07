# cc-switch-web v0.10.2-rc.1

> A prerelease focused on Web/headless local proxy support and OpenCode / OMO fixes

**[中文更新说明 Chinese Documentation ->](release-note-v0.10.2-rc.1-zh.md)**

---

## Overview

`v0.10.2-rc.1` focuses on two areas: fixing user-reported issues around existing Web UI behavior, and adding the first version of the local HTTP forward proxy for Web/headless, Docker, and remote-server workflows.

---

## New Features

### Local HTTP Proxy and Client Takeover

This release adds a Web/headless local proxy service that forwards requests using the currently selected provider configuration, with live config takeover for Claude, Codex, Gemini, and OpenCode.

**Core capabilities**:

- **Start / stop / status** - Control proxy runtime directly from Settings, with request counts, success rate, uptime, and recent error state
- **Persistent proxy settings** - Save listen host, port, upstream proxy, auto-start, logging flag, timeout settings, and per-client takeover switches
- **Credential injection from current provider** - The proxy reads base URL and API key from each client's current provider without exposing keys in the UI
- **Multi-client routing on one port** - One local proxy port can route common Claude, Codex / OpenAI, and Gemini API paths; the old `bindApp` field remains as a fallback route
- **Live config takeover and restore** - Takeover backs up the original client config, writes the local proxy URL and a `PROXY_MANAGED` placeholder, and restores original files on stop or restore
- **Provider hot switching** - When takeover is enabled, switching providers in the Web UI no longer rewrites live config; the next CLI request uses the new current provider through the running proxy
- **Web server auto-start** - When both `enabled` and `autoStart` are enabled, Web server startup automatically attempts to start the proxy
- **Recent request summaries** - Settings can show in-memory recent request summaries, with sensitive query parameters redacted and no records kept when logging is disabled
- **Streaming passthrough** - SSE / chunked upstream responses are passed through without event conversion, with first-byte and idle timeout controls
- **Single-backup failover** - On connect/timeout errors, 429, or 5xx responses, the proxy can fail over to the configured `backupCurrent` provider and persist it as the current provider

**New Web APIs**:

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

**Current takeover support**:

- Claude: writes `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN=PROXY_MANAGED`, preserves other env keys, and removes model override env keys
- Codex: writes placeholder `auth.json` plus a `config.toml` base URL pointing at the local proxy `/v1`
- Gemini: supports API-key providers; official OAuth Gemini is not treated as fully supported for takeover in this first pass
- OpenCode: available as an experimental takeover option
- OMO: proxy takeover is not supported yet

**Safe defaults**:

- Default listen address is `127.0.0.1:3456`
- The Settings UI warns when binding to `0.0.0.0`
- The proxy does not modify system proxy settings, PAC files, or Clash-style rules
- Takeover backups are stored in `~/.cc-switch/proxy-backups.json`, separate from normal settings

---

## Fixes

### Claude Provider JSON Formatting

Fixed a provider edit dialog issue where clicking “Format” could drop the outer `env` object.

The full structure is preserved after formatting:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "",
    "ANTHROPIC_BASE_URL": ""
  }
}
```

If users paste root-level `ANTHROPIC_*` environment fragments, formatting now normalizes them back into `{ "env": ... }`, avoiding a structure that Claude Code cannot read.

### Skills Install Path

Added regression coverage and confirmed that the default Anthropic `anthropics/skills` repository scans its `skills` subdirectory without installing to nested paths.

Covered install paths:

- `~/.claude/skills/<skill-name>`
- `~/.codex/skills/<skill-name>`
- `~/.config/opencode/skills/<skill-name>`

Explicitly prevented:

- `~/.claude/skills/skills/<skill-name>`
- `~/.codex/skills/skills/<skill-name>`

### OpenCode / OMO Display Consistency

- Restored MCP and Skills management entry points when OMO is the active Web UI app
- OMO Skills now clearly reuses OpenCode's `~/.config/opencode/skills`
- OMO provider management remains separate, while MCP / Skills follow the shared OpenCode configuration model
- Avoids misleading empty screens when users already have live OpenCode / OMO state on disk

---

## Tests

This release was validated with:

- `pnpm typecheck`
- `pnpm exec vitest run tests/components/ProxySettingsSection.test.tsx tests/lib/api/settings.test.ts tests/lib/adapter.core.test.ts`
- `pnpm exec vitest run src/utils/formatters.test.ts`
- `cargo test --features web-server --test proxy_web_api --manifest-path src-tauri/Cargo.toml`
- `cargo test --features web-server --lib proxy:: --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib services::skill::tests`

---

## Known Boundaries

- The local proxy is an application-level HTTP API proxy, not a transparent system proxy
- It does not modify OS global proxy settings
- PAC / Clash rules are not supported yet
- Multi-provider failover queues and token/cost accounting are not included yet
- Advanced Claude-to-OpenAI / Gemini request conversion and SSE event format conversion are deferred
- OMO does not have independent Skills / MCP storage yet; it continues to reuse OpenCode's shared configuration model
