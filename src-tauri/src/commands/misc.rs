#![allow(non_snake_case)]

use crate::init_status::InitErrorPayload;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

/// 打开外部链接
#[tauri::command]
pub async fn open_external(app: AppHandle, url: String) -> Result<bool, String> {
    let url = if url.starts_with("http://") || url.starts_with("https://") {
        url
    } else {
        format!("https://{url}")
    };

    app.opener()
        .open_url(&url, None::<String>)
        .map_err(|e| format!("打开链接失败: {e}"))?;

    Ok(true)
}

/// 检查更新
#[tauri::command]
pub async fn check_for_updates(handle: AppHandle) -> Result<bool, String> {
    handle
        .opener()
        .open_url(
            "https://github.com/Laliet/cc-switch-web/releases/latest",
            None::<String>,
        )
        .map_err(|e| format!("打开更新页面失败: {e}"))?;

    Ok(true)
}

/// 判断是否为便携版（绿色版）运行
#[tauri::command]
pub async fn is_portable_mode() -> Result<bool, String> {
    let exe_path = std::env::current_exe().map_err(|e| format!("获取可执行路径失败: {e}"))?;
    if let Some(dir) = exe_path.parent() {
        Ok(dir.join("portable.ini").is_file())
    } else {
        Ok(false)
    }
}

/// 获取应用启动阶段的初始化错误（若有）。
/// 用于前端在早期主动拉取，避免事件订阅竞态导致的提示缺失。
#[tauri::command]
pub async fn get_init_error() -> Result<Option<InitErrorPayload>, String> {
    Ok(crate::init_status::get_init_error())
}

/// Relay-Pulse 健康检查（GUI 模式使用，避免前端直接请求导致的 CORS / 网络限制问题）
#[tauri::command]
pub async fn check_relay_pulse() -> Result<Value, String> {
    const RELAY_PULSE_STATUS_URL: &str = "https://relaypulse.top/api/status";

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("cc-switch/health-proxy")
        .build()
        .map_err(|err| format!("创建 HTTP 客户端失败: {err}"))?;

    let response = client
        .get(RELAY_PULSE_STATUS_URL)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|err| {
            if err.is_timeout() {
                format!("请求 Relay-Pulse API 超时: {err}")
            } else {
                format!("请求 Relay-Pulse API 失败: {err}")
            }
        })?;

    if !response.status().is_success() {
        return Err(format!(
            "Relay-Pulse API 返回非成功状态: {}",
            response.status()
        ));
    }

    let body = response
        .json::<Value>()
        .await
        .map_err(|err| format!("解析 Relay-Pulse 响应失败: {err}"))?;

    Ok(body)
}
