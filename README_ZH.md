# cc-switch-web

> 面向 Claude Code、Codex、Gemini CLI、OpenCode、OMO 与 Hermes Agent 的 Web 版 CC Switch。

<sub>🙏 本项目是 [farion1231/cc-switch](https://github.com/farion1231/cc-switch)（Jason Young）的 fork 版本。感谢原作者的出色工作。本 fork 添加了 Web 服务器模式、Hermes Agent 集成、Token Plan 模板与远程终端。</sub>

[![Release](https://img.shields.io/github/v/release/Bandersnatch0x/cc-switch-web?style=flat-square&logo=github&label=Release)](https://github.com/Bandersnatch0x/cc-switch-web/releases/latest)
[![License](https://img.shields.io/github/license/Bandersnatch0x/cc-switch-web?style=flat-square)](LICENSE)

**面向 Claude Code / Codex / Gemini CLI / OpenCode / OMO / Hermes Agent 的跨平台 Web 版一站式助手**

[English](README.md) | 中文 | [法律声明](LEGAL_NOTICE.md) | [更新日志](CHANGELOG.md)

---

## 项目简介

**cc-switch-web** 是一个面向 **Claude Code**、**Codex**、**Gemini CLI**、**OpenCode**、**oh-my-opencode（OMO）** 和 **Hermes Agent** 的跨平台 Web 版 **CC Switch**。它支持供应商切换、MCP 管理、技能安装、系统提示词编辑，并可同时运行在桌面环境与无头云端环境中。

核心功能：

- **一键切换供应商** — 支持 OpenAI 兼容 API 端点
- **统一 MCP 管理** — 跨 Claude/Codex/Gemini/OpenCode/Hermes 统一管理
- **技能市场** — 从 GitHub 浏览并安装 Claude 技能
- **提示词编辑器** — 内置语法高亮
- **配置备份/恢复** — 支持版本历史
- **Web 服务器模式** — 支持 Basic Auth，适用于云端/无头部署
- **Hermes Agent 集成** — 自动轮换、Token Plan 模板、远程终端

---

## 更新内容

### v1.0.0 — Hermes Agent 与远程终端

- **Hermes Agent 支持**：完整集成作为托管应用，支持供应商切换、目录设置和能力标志
- **Token Plan 模板**：一键配置 Kimi、Zhipu、MiniMax（通过 Anthropic 兼容端点）
- **AgentSidebar**：新侧边栏布局，插件模式过滤（仅显示 Hermes）
- **RemoteTerminal**：内置 xterm.js 终端，WebSocket PTY 二进制协议
- **自动轮换后端**：Hermes 轮换任务随 web server 自动启动
- **i18n 审计**：补充 88 个缺失的翻译 key（en.json + zh.json）

### v0.11.0-rc.2 - 预发布

- 新增 Web/headless 本地 HTTP 转发代理 v1
- 强化代理启动与应用接管体验
- 修复 Claude provider JSON 格式化问题
- 修复 Anthropic Skills 默认仓库扫描路径

### v0.10.1 - 稳定版

- 推荐用于日常使用和生产环境

---

## 功能特性

### 核心功能

- **多供应商管理**：一键切换不同 AI 供应商（OpenAI 兼容端点）
- **统一 MCP 管理**：跨应用配置 Model Context Protocol 服务器
- **技能市场**：浏览并安装 Claude 技能
- **提示词管理**：创建和管理系统提示词
- **远程终端**：内置 xterm.js 终端，通过 WebSocket PTY 直接访问服务器 shell

### 扩展功能

- **备份自动故障转移**：主供应商故障时自动切换
- **Hermes 自动轮换**：可配置计划的自动供应商轮换
- **导入/导出**：配置备份与恢复
- **跨平台**：支持 Windows、macOS、Linux（桌面）和 Web/Docker（服务器）

---

## 快速开始

### 方式一：Web 服务器模式（推荐）

适用于无头/云端部署的轻量级 Web 服务器。

#### 方法 A：预编译二进制（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/Bandersnatch0x/cc-switch-web/main/scripts/deploy-web.sh | bash -s -- --prebuilt
```

#### 方法 B：Docker

```bash
docker run -p 3000:3000 ghcr.io/bandersnatch0x/cc-switch-web:latest
```

#### 方法 C：从源码构建

```bash
git clone https://github.com/Bandersnatch0x/cc-switch-web.git
cd cc-switch-web
pnpm install
pnpm build:web
cd src-tauri
cargo build --release --features web-server --example server
HOST=0.0.0.0 PORT=3000 ./target/release/examples/server
```

### Web 服务器登录

- **用户名**：`admin`
- **密码**：首次运行时自动生成，存储在 `~/.cc-switch/web_password`

### 安全

- 所有 API 请求需要 Basic Auth
- CSRF token 自动注入和验证
- 生产环境建议部署在反向代理后并使用 TLS

### 方式二：桌面应用（GUI）

```bash
pnpm install
pnpm tauri dev    # 开发模式
pnpm tauri build  # 构建
```

---

## 使用指南

### 1. 添加供应商

1. 选择目标应用（Claude Code / Codex / Gemini / OpenCode / OMO / Hermes）
2. 点击 **"添加供应商"**
3. 选择预设或"自定义"
4. 填写：名称、Base URL、API Key、模型

### 2. 切换供应商

- 点击供应商卡片上的 **"启用"** 按钮
- 活动供应商会立即写入 CLI 配置文件

### 3. 管理 MCP 服务器

1. 进入 **MCP** 标签
2. 点击 **"添加服务器"**
3. 选择传输类型：`stdio`、`http` 或 `sse`

### 4. 安装技能

1. 进入 **Skills** 标签
2. 浏览可用技能
3. 点击 **"安装"**

### 5. Hermes Token Plan

1. 进入 **Hermes** 标签 → **Token Plan**
2. 选择预设模板（Kimi / Zhipu / MiniMax）
3. API key 和 base URL 自动填充
4. 按需启用自动轮换

### 6. 远程终端

1. 点击侧边栏终端图标
2. xterm.js 终端在对话框中打开
3. 通过 WebSocket PTY 二进制协议连接到服务器 shell

---

## 配置文件

| 应用 | 配置文件 |
|------|----------|
| **Claude Code** | `~/.claude.json` (MCP), `~/.claude/settings.json` |
| **Codex** | `~/.codex/auth.json`, `~/.codex/config.toml` |
| **Gemini** | `~/.gemini/.env`, `~/.gemini/settings.json` |
| **Hermes** | `~/.hermes/config.json` |

CC-Switch 自身配置：`~/.cc-switch/config.json`

---

## 开发

```bash
pnpm install          # 安装依赖
pnpm tauri dev        # 桌面开发模式
pnpm dev:renderer     # 前端开发服务器
pnpm build:web        # 构建 Web 资源
npx tsc --noEmit      # 类型检查
pnpm test:unit        # 运行测试
```

---

## 技术栈

- **前端**：React 18、TypeScript、Vite、Tailwind CSS、TanStack Query、Radix UI、CodeMirror、react-i18next、xterm.js、Zustand
- **后端**：Rust、Tauri 2.x、Axum（web server 模式）、tower-http
- **工具**：pnpm、Vitest、MSW

---

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)

---

## 致谢

本项目是 [cc-switch](https://github.com/farion1231/cc-switch)（Jason Young）的 fork 版本。感谢原作者的出色工作。

基于 Laliet 的 cc-switch-web fork（添加了 web/server 运行时、CORS 控制、Basic Auth）。本版本新增 Hermes Agent 集成、Token Plan 模板、AgentSidebar、RemoteTerminal 和自动轮换。

---

## 许可证

MIT License — 详见 [LICENSE](LICENSE)
