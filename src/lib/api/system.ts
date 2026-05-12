/**
 * System API — runtime mode detection (web-server / plugin mode).
 *
 * In Tauri desktop mode, `invoke()` is the primary transport.
 * In plugin (web-server) mode, the Axum backend exposes HTTP endpoints.
 * This module uses `fetch()` against the same-origin `/api/system` routes
 * so it works in both contexts.
 */

export type RuntimeMode = "plugin" | "standalone";

export interface ModeResponse {
  mode: RuntimeMode;
}

export const systemApi = {
  /**
   * GET /api/system/mode
   * Returns the current runtime mode: "plugin" or "standalone".
   * Falls back to "standalone" on network errors (safe default).
   */
  async getMode(): Promise<RuntimeMode> {
    try {
      const res = await fetch("/api/system/mode");
      if (!res.ok) return "standalone";
      const data: ModeResponse = await res.json();
      return data.mode;
    } catch {
      return "standalone";
    }
  },
};
