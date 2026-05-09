# cc-switch-web v0.11.0-rc.2

> A prerelease hardening update for Web/headless local proxy startup and client takeover UX

**[中文更新说明 Chinese Documentation ->](release-note-v0.11.0-rc.2-zh.md)**

---

## Overview

`v0.11.0-rc.2` builds on `v0.11.0-rc.1` and focuses on issues found during real server testing of the new local proxy and client takeover workflow.

This is still a prerelease. The local proxy can modify real client configuration files during takeover, so it should continue to be validated as an RC before a stable `0.11.0` release.

---

## Fixed

- Prevent repeated proxy takeover requests when takeover switches are toggled quickly.
- Disable takeover switches while a takeover request is in progress.
- Deduplicate proxy takeover success toasts with stable toast IDs.
- Give proxy start, stop, restore, and takeover success toasts a short explicit duration so repeated actions do not leave stacked or stuck notifications.
- Refresh proxy status and show a friendly "already running" message when starting a proxy that is already running in the current process.
- Show a clearer user-facing error when the configured proxy port is occupied by another process.
- Avoid duplicate Claude entries in the proxy takeover target list.
- Allow failover on a streaming first-byte timeout when no response body has been sent yet.

---

## UX Updates

- Clarify that "application takeover" means cc-switch-web temporarily modifies local client configuration.
- Clarify that the default bound client is only a fallback when the proxy cannot infer request ownership.
- Add per-client proxy test buttons such as "Test Claude" and "Test Codex".
- Increase the default first-byte timeout from 30 seconds to 90 seconds for real upstream environments.

---

## Validation

This release was validated with:

- `pnpm typecheck`
- `pnpm exec vitest run tests/components/ProxySettingsSection.test.tsx tests/hooks/useSettingsForm.test.tsx tests/lib/api/settings.test.ts`
- `pnpm exec vitest run`
- `cargo test --features web-server --test proxy_web_api --manifest-path src-tauri/Cargo.toml`
- `cargo test --features web-server --lib proxy:: --manifest-path src-tauri/Cargo.toml`
- `cargo check --no-default-features --features web-server --lib --manifest-path src-tauri/Cargo.toml`
- `cargo check --no-default-features --features web-server --example server --manifest-path src-tauri/Cargo.toml`

---

## Known Boundaries

- The local proxy is an application-level HTTP API proxy, not a transparent system proxy.
- It does not modify OS global proxy settings.
- PAC / Clash-style rules are not supported.
- OpenCode takeover remains experimental.
- Gemini OAuth provider takeover is intentionally unsupported; use a Gemini API key provider for takeover testing.
- Multi-provider failover queues, circuit breaker UI, and cross-provider request/stream format conversion are deferred to later releases.
