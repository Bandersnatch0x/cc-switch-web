/**
 * useRuntimeMode — detects whether CC Switch is running in plugin mode
 * (embedded inside Hermes web-server) or standalone (Tauri desktop).
 *
 * Plugin mode triggers UI simplification:
 *   - Only the Hermes app tab is shown
 *   - AppSwitcher is hidden
 *   - Sidebar filters to Hermes only
 */

import { useQuery } from "@tanstack/react-query";
import { systemApi, type RuntimeMode } from "@/lib/api";

export type { RuntimeMode };

export function useRuntimeMode() {
  const { data: mode, isLoading } = useQuery<RuntimeMode>({
    queryKey: ["runtimeMode"],
    queryFn: () => systemApi.getMode(),
    staleTime: Infinity,       // mode never changes at runtime
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const resolvedMode: RuntimeMode = mode ?? "standalone";
  const isPlugin = resolvedMode === "plugin";

  return { mode: resolvedMode, isPlugin, isLoading };
}
