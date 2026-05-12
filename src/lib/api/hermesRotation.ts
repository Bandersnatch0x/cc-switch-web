/**
 * Hermes 自动轮换 API 封装
 *
 * 通过 CC Switch 后端代理读写 Hermes config.yaml 中的 rotation 区段。
 * 所有端点走 `/api/hermes/rotation/*`。
 */

const API_BASE = "/api/hermes/rotation";

// ─── Types ───────────────────────────────────────────────────────────────────

/** 单个 provider 的 429 计数 */
export interface Provider429Count {
  provider: string;
  count: number;
  last_at?: string; // ISO timestamp
}

/** 完整的轮换配置（从 config.yaml 读取） */
export interface RotationConfig {
  enabled: boolean;
  balance_threshold?: number; // 余额低于此值触发轮换
  rate_limit_429?: number; // 429 达到此上限触发轮换
  rotation_interval_seconds?: number; // 自动轮询间隔（秒）
  providers_429?: Provider429Count[]; // 各 provider 的 429 计数
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${body || resp.statusText}`);
  }
  return resp.json();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** 获取当前轮换配置 */
export async function getRotationConfig(): Promise<RotationConfig> {
  return apiFetch<RotationConfig>("/config");
}

/** 更新轮换配置（partial merge） */
export async function updateRotationConfig(
  patch: Partial<RotationConfig>,
): Promise<{ backup_path?: string }> {
  return apiFetch("/config", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

/** 立即触发一次手动轮换 */
export async function triggerRotation(): Promise<{
  rotated_to: string;
  previous: string;
}> {
  return apiFetch("/rotate", { method: "POST" });
}

/** 获取各 provider 的 429 计数列表 */
export async function get429Counts(): Promise<Provider429Count[]> {
  return apiFetch<Provider429Count[]>("/429-counts");
}

/** 重置某个 provider 的 429 计数 */
export async function reset429Count(
  provider: string,
): Promise<{ backup_path?: string }> {
  return apiFetch(`/429-counts/${encodeURIComponent(provider)}`, {
    method: "DELETE",
  });
}
