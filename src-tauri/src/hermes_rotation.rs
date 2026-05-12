#![cfg(feature = "web-server")]

//! Hermes 自动轮换后端
//!
//! 当代理收到 429 (rate-limit) 响应时自动切换到下一个可用 provider。
//! 配置持久化到 `~/.hermes/cc-switch-remote.toml`。

use std::{
    fs,
    path::PathBuf,
    sync::{Arc, OnceLock, RwLock},
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tokio::{
    sync::Mutex,
    task::JoinHandle,
};

use crate::{config::get_home_dir, error::AppError};

// ─── Config ───────────────────────────────────────────────────────────────────

/// 单个 provider 的轮换权重和状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotationProviderEntry {
    /// provider id（对应 config.json 里的 id）
    pub id: String,
    /// 权重（越高越优先），默认 1
    #[serde(default = "default_weight")]
    pub weight: u32,
    /// 是否启用
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_weight() -> u32 { 1 }
fn default_true() -> bool { true }

/// 轮换配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RotationConfig {
    /// 是否启用自动轮换
    #[serde(default)]
    pub enabled: bool,

    /// 监控的目标 app（claude / codex / gemini / opencode）
    #[serde(default = "default_target_app")]
    pub target_app: String,

    /// 轮换策略：round-robin / weighted-random / least-errors
    #[serde(default = "default_strategy")]
    pub strategy: String,

    /// 触发轮换的 429 次数阈值（在 cooldown 窗口内）
    #[serde(default = "default_threshold")]
    pub threshold_429: u32,

    /// 429 计数窗口（秒），窗口内达到阈值才轮换
    #[serde(default = "default_cooldown_secs")]
    pub cooldown_secs: u64,

    /// 轮换后冷却时间（秒），冷却期内不再轮换
    #[serde(default = "default_rotate_cooldown_secs")]
    pub rotate_cooldown_secs: u64,

    /// 最大自动轮换次数（防止无限循环），0 = 无限
    #[serde(default)]
    pub max_rotations: u32,

    /// provider 列表
    #[serde(default)]
    pub providers: Vec<RotationProviderEntry>,
}

fn default_target_app() -> String { "claude".to_string() }
fn default_strategy() -> String { "round-robin".to_string() }
fn default_threshold() -> u32 { 3 }
fn default_cooldown_secs() -> u64 { 60 }
fn default_rotate_cooldown_secs() -> u64 { 30 }

impl Default for RotationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            target_app: default_target_app(),
            strategy: default_strategy(),
            threshold_429: default_threshold(),
            cooldown_secs: default_cooldown_secs(),
            rotate_cooldown_secs: default_rotate_cooldown_secs(),
            max_rotations: 0,
            providers: Vec::new(),
        }
    }
}

// ─── Runtime State ────────────────────────────────────────────────────────────

/// 轮换运行时状态（只读查询用）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RotationState {
    /// 当前是否正在运行
    pub running: bool,
    /// 当前 provider index（round-robin 游标）
    pub current_index: usize,
    /// 当前 provider id
    pub current_provider_id: String,
    /// 当前窗口内 429 计数
    pub error_count_429: u32,
    /// 已自动轮换次数
    pub rotations_performed: u32,
    /// 最后一次 429 时间
    pub last_429_at: Option<String>,
    /// 最后一次轮换时间
    pub last_rotation_at: Option<String>,
    /// 上一次轮换的时间戳（用于冷却判断，不序列化）
    #[serde(skip)]
    pub last_rotation_instant: Option<Instant>,
    /// 429 窗口开始时间（用于窗口重置，不序列化）
    #[serde(skip)]
    pub window_start_instant: Option<Instant>,
}

impl Default for RotationState {
    fn default() -> Self {
        Self {
            running: false,
            current_index: 0,
            current_provider_id: String::new(),
            error_count_429: 0,
            rotations_performed: 0,
            last_429_at: None,
            last_rotation_at: None,
            last_rotation_instant: None,
            window_start_instant: None,
        }
    }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

fn config_path() -> Option<PathBuf> {
    get_home_dir().map(|home| home.join(".hermes").join("cc-switch-remote.toml"))
}

pub fn load_config() -> RotationConfig {
    let Some(path) = config_path() else {
        return RotationConfig::default();
    };
    if !path.exists() {
        return RotationConfig::default();
    }
    match fs::read_to_string(&path) {
        Ok(content) => toml::from_str(&content).unwrap_or_else(|e| {
            log::warn!("Failed to parse rotation config {}: {}", path.display(), e);
            RotationConfig::default()
        }),
        Err(e) => {
            log::warn!("Failed to read rotation config {}: {}", path.display(), e);
            RotationConfig::default()
        }
    }
}

pub fn save_config(config: &RotationConfig) -> Result<(), AppError> {
    let Some(path) = config_path() else {
        return Err(AppError::Config("Cannot determine home directory".into()));
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
    }
    let toml_str = toml::to_string_pretty(config)
        .map_err(|e| AppError::Config(format!("TOML serialization failed: {e}")))?;
    fs::write(&path, toml_str).map_err(|e| AppError::io(&path, e))?;
    Ok(())
}

// ─── Internal State (Singleton) ───────────────────────────────────────────────

struct RotationRuntime {
    state: RwLock<RotationState>,
    handle: Mutex<Option<JoinHandle<()>>>,
    /// 回调：执行 provider 切换的闭包（解耦 app_state 依赖）
    switch_fn: Mutex<Option<Arc<dyn Fn(String, String) -> Result<(), String> + Send + Sync>>>,
}

fn runtime() -> &'static Arc<RotationRuntime> {
    static RUNTIME: OnceLock<Arc<RotationRuntime>> = OnceLock::new();
    RUNTIME.get_or_init(|| {
        Arc::new(RotationRuntime {
            state: RwLock::new(RotationState::default()),
            handle: Mutex::new(None),
            switch_fn: Mutex::new(None),
        })
    })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// 注册切换回调（在 web server 启动时调用一次）
pub async fn set_switch_fn(
    f: impl Fn(String, String) -> Result<(), String> + Send + Sync + 'static,
) {
    let rt = runtime();
    let mut guard = rt.switch_fn.lock().await;
    *guard = Some(Arc::new(f));
}

/// 启动轮换后台任务
pub async fn start_rotation_task() -> Result<(), AppError> {
    let config = load_config();
    if !config.enabled {
        return Err(AppError::Config("Rotation is disabled in config".into()));
    }
    if config.providers.is_empty() {
        return Err(AppError::Config("No providers configured for rotation".into()));
    }

    let rt = runtime();

    // 停止旧任务
    stop_rotation_task().await;

    // 重置状态
    {
        let mut state = rt.state.write().map_err(AppError::from)?;
        *state = RotationState {
            running: true,
            current_index: 0,
            current_provider_id: config
                .providers
                .first()
                .map(|p| p.id.clone())
                .unwrap_or_default(),
            window_start_instant: Some(Instant::now()),
            ..Default::default()
        };
    }

    let rt_clone = rt.clone();
    let handle = tokio::spawn(async move {
        rotation_loop(rt_clone).await;
    });

    {
        let mut guard = rt.handle.lock().await;
        *guard = Some(handle);
    }

    log::info!(
        "Rotation task started: app={}, strategy={}, providers={}",
        config.target_app,
        config.strategy,
        config.providers.len()
    );
    Ok(())
}

/// 停止轮换后台任务
pub async fn stop_rotation_task() {
    let rt = runtime();
    let mut guard = rt.handle.lock().await;
    if let Some(handle) = guard.take() {
        handle.abort();
    }
    if let Ok(mut state) = rt.state.write() {
        state.running = false;
    }
}

/// 获取当前轮换状态
pub fn get_state() -> RotationState {
    let rt = runtime();
    rt.state
        .read()
        .map(|s| {
            let mut clone = s.clone();
            // 清除 Instant（不可序列化）
            clone.last_rotation_instant = None;
            clone.window_start_instant = None;
            clone
        })
        .unwrap_or_default()
}

/// 外部报告 429 错误（由 proxy handler 调用）
pub async fn report_429() {
    let rt = runtime();
    let (should_rotate, current_provider) = {
        let mut state = match rt.state.write() {
            Ok(s) => s,
            Err(_) => return,
        };
        if !state.running {
            return;
        }

        let now = chrono::Utc::now();
        state.error_count_429 += 1;
        state.last_429_at = Some(now.to_rfc3339());

        // Initialize window start if not set
        if state.window_start_instant.is_none() {
            state.window_start_instant = Some(Instant::now());
        }

        let config = load_config();
        let threshold = config.threshold_429;
        let cooldown = Duration::from_secs(config.rotate_cooldown_secs);

        // 检查冷却期
        if let Some(last) = state.last_rotation_instant {
            if last.elapsed() < cooldown {
                log::debug!(
                    "429 reported but in cooldown ({}s left)",
                    (cooldown - last.elapsed()).as_secs()
                );
                return;
            }
        }

        let should = state.error_count_429 >= threshold;
        let provider = state.current_provider_id.clone();
        (should, provider)
    };

    if should_rotate {
        log::warn!(
            "429 threshold reached for provider '{}', triggering rotation",
            current_provider
        );
        rotate_now_internal(rt).await;
    }
}

/// 手动触发轮换
pub async fn rotate_now() -> Result<String, AppError> {
    let rt = runtime();
    // Check running state and drop guard before any .await
    {
        let state = rt.state.read().map_err(AppError::from)?;
        if !state.running {
            return Err(AppError::Config("Rotation task is not running".into()));
        }
    }

    rotate_now_internal(rt).await;
    let state = get_state();
    Ok(state.current_provider_id)
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async fn rotation_loop(rt: Arc<RotationRuntime>) {
    let mut interval = tokio::time::interval(Duration::from_secs(5));

    loop {
        interval.tick().await;

        let config = load_config();
        if !config.enabled {
            log::info!("Rotation disabled, stopping loop");
            break;
        }

        // 重置过期的 429 计数窗口
        let window = Duration::from_secs(config.cooldown_secs);
        if let Ok(mut state) = rt.state.write() {
            if state.error_count_429 > 0 {
                if let Some(ws) = state.window_start_instant {
                    if ws.elapsed() >= window {
                        log::debug!(
                            "429 window expired ({}s), resetting count from {}",
                            config.cooldown_secs,
                            state.error_count_429
                        );
                        state.error_count_429 = 0;
                        state.window_start_instant = Some(Instant::now());
                    }
                }
            }
        }
    }

    if let Ok(mut state) = rt.state.write() {
        state.running = false;
    }
}

async fn rotate_now_internal(rt: &Arc<RotationRuntime>) {
    let config = load_config();
    let enabled_providers: Vec<_> = config
        .providers
        .iter()
        .filter(|p| p.enabled)
        .collect();

    if enabled_providers.is_empty() {
        log::warn!("No enabled providers for rotation");
        return;
    }

    // 检查最大轮换次数
    let max = config.max_rotations;
    {
        let state = rt.state.read().ok();
        if let Some(state) = state {
            if max > 0 && state.rotations_performed >= max {
                log::warn!(
                    "Max rotations ({}) reached, skipping",
                    max
                );
                return;
            }
        }
    }

    let new_index = {
        let state = rt.state.read().ok();
        let current_idx = state.as_ref().map(|s| s.current_index).unwrap_or(0);

        match config.strategy.as_str() {
            "round-robin" => (current_idx + 1) % enabled_providers.len(),
            "weighted-random" => {
                use rand::Rng;
                let total: u32 = enabled_providers.iter().map(|p| p.weight).sum();
                if total == 0 {
                    (current_idx + 1) % enabled_providers.len()
                } else {
                    let mut rng = rand::thread_rng();
                    let mut roll = rng.gen_range(0..total);
                    let mut chosen = 0;
                    for (i, p) in enabled_providers.iter().enumerate() {
                        roll = roll.saturating_sub(p.weight);
                        if roll == 0 {
                            chosen = i;
                            break;
                        }
                    }
                    chosen
                }
            }
            _ => (current_idx + 1) % enabled_providers.len(),
        }
    };

    let new_provider = &enabled_providers[new_index];

    // 执行切换
    let switch_fn = rt.switch_fn.lock().await;
    if let Some(f) = switch_fn.as_ref() {
        match f(config.target_app.clone(), new_provider.id.clone()) {
            Ok(()) => {
                log::info!(
                    "Rotated to provider '{}' (index {})",
                    new_provider.id,
                    new_index
                );
            }
            Err(e) => {
                log::error!("Failed to rotate to provider '{}': {}", new_provider.id, e);
                return;
            }
        }
    } else {
        log::warn!("No switch function registered, rotation is a no-op");
    }

    // 更新状态
    if let Ok(mut state) = rt.state.write() {
        state.current_index = new_index;
        state.current_provider_id = new_provider.id.clone();
        state.error_count_429 = 0;
        state.rotations_performed += 1;
        state.last_rotation_at = Some(chrono::Utc::now().to_rfc3339());
        state.last_rotation_instant = Some(Instant::now());
    }
}
