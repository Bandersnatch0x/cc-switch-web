#![cfg(feature = "web-server")]

use std::sync::Arc;

use axum::{extract::State, Json};
use serde::Deserialize;

use crate::{
    app_config::AppType,
    proxy::{self, ProxyRecentLog, ProxyService, ProxyStatus, ProxyTestResult},
    settings::ProxySettings,
    store::AppState,
};

use super::{ApiError, ApiResult};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettingsPayload {
    pub settings: ProxySettings,
}

pub async fn get_status(State(state): State<Arc<AppState>>) -> ApiResult<ProxyStatus> {
    Ok(Json(proxy::status_for_state(&state).await))
}

pub async fn get_config(State(_state): State<Arc<AppState>>) -> ApiResult<ProxySettings> {
    Ok(Json(ProxyService::config()))
}

pub async fn save_config(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<ProxySettingsPayload>,
) -> ApiResult<ProxySettings> {
    let config = ProxyService::save_config(payload.settings).map_err(ApiError::from)?;
    if !config.enable_logging {
        proxy::clear_recent_logs().await;
    }
    Ok(Json(config))
}

pub async fn save_settings(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<ProxySettingsPayload>,
) -> ApiResult<bool> {
    let config = ProxyService::save_config(payload.settings).map_err(ApiError::from)?;
    if !config.enable_logging {
        proxy::clear_recent_logs().await;
    }
    Ok(Json(true))
}

pub async fn start(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ProxySettingsPayload>,
) -> ApiResult<ProxyStatus> {
    let status = ProxyService::start(state, payload.settings)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(status))
}

pub async fn stop(State(state): State<Arc<AppState>>) -> ApiResult<ProxyStatus> {
    let status = ProxyService::stop(state).await.map_err(ApiError::from)?;
    Ok(Json(status))
}

pub async fn test(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ProxySettingsPayload>,
) -> ApiResult<ProxyTestResult> {
    let result = proxy::test_settings(state, payload.settings)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(result))
}

pub async fn get_takeover(State(state): State<Arc<AppState>>) -> ApiResult<ProxyStatus> {
    Ok(Json(proxy::status_for_state(&state).await))
}

pub async fn set_takeover(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(app): axum::extract::Path<String>,
    Json(payload): Json<TakeoverPayload>,
) -> ApiResult<proxy::ProxyTakeoverResult> {
    let app_type = AppType::parse_supported(&app).map_err(ApiError::from)?;
    let result = ProxyService::set_takeover(state, app_type, payload.enabled)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(result))
}

pub async fn restore(State(state): State<Arc<AppState>>) -> ApiResult<ProxyStatus> {
    let status = ProxyService::restore(state).await.map_err(ApiError::from)?;
    Ok(Json(status))
}

pub async fn recover_stale_takeover(State(state): State<Arc<AppState>>) -> ApiResult<ProxyStatus> {
    let status = ProxyService::recover_stale_takeover(state)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(status))
}

pub async fn recent_logs(State(_state): State<Arc<AppState>>) -> ApiResult<Vec<ProxyRecentLog>> {
    Ok(Json(proxy::recent_logs().await))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeoverPayload {
    pub enabled: bool,
}
