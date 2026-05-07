#![cfg(feature = "web-server")]

pub mod adapters;
pub mod live;
pub mod server;
pub mod service;
pub mod types;

pub use server::{
    clear_recent_logs, recent_logs, start_from_saved_settings, start_proxy, status,
    status_for_state, stop_proxy, test_settings,
};
pub use service::ProxyService;
pub use types::{ProxyRecentLog, ProxyStatus, ProxyTakeoverResult, ProxyTestResult};
