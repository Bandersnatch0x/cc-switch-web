#![cfg(feature = "web-server")]

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{hermes_rotation, store::AppState};

use super::{ApiError, ApiResult};

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RotationStatusResponse {
    pub config: hermes_rotation::RotationConfig,
    pub state: hermes_rotation::RotationState,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfigPayload {
    pub config: hermes_rotation::RotationConfig,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RotateNowResponse {
    pub new_provider_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportErrorPayload {
    /// HTTP status code (must be 429)
    pub status: u16,
    #[serde(default)]
    pub provider_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportErrorResponse {
    pub recorded: bool,
    pub current_count: u32,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// GET /rotation/config — 读取轮换配置
pub async fn get_config(
    State(_state): State<Arc<AppState>>,
) -> ApiResult<hermes_rotation::RotationConfig> {
    Ok(Json(hermes_rotation::load_config()))
}

/// PUT /rotation/config — 更新轮换配置
pub async fn update_config(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigPayload>,
) -> ApiResult<hermes_rotation::RotationConfig> {
    hermes_rotation::save_config(&payload.config).map_err(ApiError::from)?;
    Ok(Json(payload.config))
}

/// GET /rotation/state — 获取运行时状态
pub async fn get_status(
    State(_state): State<Arc<AppState>>,
) -> ApiResult<RotationStatusResponse> {
    let config = hermes_rotation::load_config();
    let state = hermes_rotation::get_state();
    Ok(Json(RotationStatusResponse { config, state }))
}

/// POST /rotation/report-error — 报告 429 错误
pub async fn report_error(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<ReportErrorPayload>,
) -> ApiResult<ReportErrorResponse> {
    if payload.status != 429 {
        return Err(ApiError::bad_request(
            "Only 429 status codes are supported for error reporting",
        ));
    }

    hermes_rotation::report_429().await;
    let state = hermes_rotation::get_state();
    Ok(Json(ReportErrorResponse {
        recorded: true,
        current_count: state.error_count_429,
    }))
}

/// POST /rotation/rotate-now — 手动触发轮换
pub async fn rotate_now(
    State(_state): State<Arc<AppState>>,
) -> ApiResult<RotateNowResponse> {
    let new_id = hermes_rotation::rotate_now().await.map_err(ApiError::from)?;
    Ok(Json(RotateNowResponse {
        new_provider_id: new_id,
    }))
}

/// POST /rotation/start — 启动轮换后台任务
pub async fn start_rotation(
    State(_state): State<Arc<AppState>>,
) -> ApiResult<hermes_rotation::RotationState> {
    match hermes_rotation::start_rotation_task().await {
        Ok(()) => Ok(Json(hermes_rotation::get_state())),
        Err(e) => Err(ApiError::from(e)),
    }
}

/// POST /rotation/stop — 停止轮换后台任务
pub async fn stop_rotation(
    State(_state): State<Arc<AppState>>,
) -> ApiResult<hermes_rotation::RotationState> {
    hermes_rotation::stop_rotation_task().await;
    Ok(Json(hermes_rotation::get_state()))
}
