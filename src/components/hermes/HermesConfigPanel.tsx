import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Save,
  RefreshCw,
  RotateCw,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  type RotationConfig,
  type Provider429Count,
  getRotationConfig,
  updateRotationConfig,
  triggerRotation,
  get429Counts,
} from "@/lib/api/hermesRotation";

export function HermesConfigPanel() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<{
    default: string;
    provider: string;
    base_url: string;
    api_key: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Rotation state ──────────────────────────────────────────────────────
  const [rotation, setRotation] = useState<RotationConfig | null>(null);
  const [rotationLoading, setRotationLoading] = useState(true);
  const [rotationSaving, setRotationSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [counts429, setCounts429] = useState<Provider429Count[]>([]);
  const [rotationOpen, setRotationOpen] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  // Load rotation data when section is opened
  useEffect(() => {
    if (rotationOpen && !rotation && !rotationLoading) {
      loadRotationConfig();
    }
  }, [rotationOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/hermes/model", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setError(msg);
      toast.error(t("hermes.loadFailed", { defaultValue: "加载配置失败" }));
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const response = await fetch("/api/hermes/model", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      toast.success(t("hermes.saveSuccess", { defaultValue: "配置已保存" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setConfig((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  // ─── Rotation handlers ───────────────────────────────────────────────────

  const loadRotationConfig = useCallback(async () => {
    try {
      setRotationLoading(true);
      const [cfg, counts] = await Promise.all([
        getRotationConfig(),
        get429Counts().catch(() => []), // non-fatal if endpoint missing
      ]);
      setRotation(cfg);
      setCounts429(counts);
    } catch {
      // Rotation endpoints may not exist yet — show defaults
      setRotation({
        enabled: false,
        balance_threshold: 0,
        rate_limit_429: 3,
        rotation_interval_seconds: 60,
      });
    } finally {
      setRotationLoading(false);
    }
  }, []);

  const saveRotation = useCallback(
    async (patch: Partial<RotationConfig>) => {
      if (!rotation) return;
      const next = { ...rotation, ...patch };
      setRotation(next); // optimistic
      try {
        setRotationSaving(true);
        await updateRotationConfig(patch);
        toast.success(
          t("hermes.rotation.saveSuccess", {
            defaultValue: "轮换配置已保存",
          }),
        );
      } catch (err) {
        // rollback
        setRotation(rotation);
        const msg = err instanceof Error ? err.message : "Failed to save";
        toast.error(msg);
      } finally {
        setRotationSaving(false);
      }
    },
    [rotation, t],
  );

  const handleRotateNow = useCallback(async () => {
    try {
      setRotating(true);
      const result = await triggerRotation();
      toast.success(
        t("hermes.rotation.rotated", {
          defaultValue: `已轮换至 ${result.rotated_to}`,
          provider: result.rotated_to,
        }),
      );
      // Refresh 429 counts after rotation
      try {
        const counts = await get429Counts();
        setCounts429(counts);
      } catch {
        /* non-fatal */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rotation failed";
      toast.error(msg);
    } finally {
      setRotating(false);
    }
  }, [t]);

  // ─── Loading / error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error}</p>
        <Button variant="outline" onClick={loadConfig} className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        {t("hermes.noConfig", { defaultValue: "无配置" })}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          {t("hermes.title", { defaultValue: "Hermes 配置" })}
        </h2>
        <Button variant="outline" size="sm" onClick={loadConfig}>
          <RefreshCw className="mr-1 h-4 w-4" />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="space-y-4">
        {/* ── Provider / Model fields ─────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="hermes-provider">
            {t("hermes.provider", { defaultValue: "Provider" })}
          </Label>
          <Input
            id="hermes-provider"
            value={config.provider}
            onChange={(e) => handleChange("provider", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hermes-default">
            {t("hermes.defaultModel", { defaultValue: "默认模型" })}
          </Label>
          <Input
            id="hermes-default"
            value={config.default}
            onChange={(e) => handleChange("default", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hermes-base-url">
            {t("hermes.baseUrl", { defaultValue: "Base URL" })}
          </Label>
          <Input
            id="hermes-base-url"
            value={config.base_url}
            onChange={(e) => handleChange("base_url", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hermes-api-key">
            {t("hermes.apiKey", { defaultValue: "API Key" })}
          </Label>
          <Input
            id="hermes-api-key"
            type="password"
            value={config.api_key}
            onChange={(e) => handleChange("api_key", e.target.value)}
          />
        </div>

        <Button onClick={saveConfig} disabled={saving} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {saving ? t("common.saving") : t("common.save")}
        </Button>

        {/* ── Auto-Rotation Section ───────────────────────────────────── */}
        <Collapsible open={rotationOpen} onOpenChange={setRotationOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2">
              <RotateCw className="h-4 w-4" />
              {t("hermes.rotation.title", {
                defaultValue: "自动轮换",
              })}
              {rotation?.enabled && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                  {t("hermes.rotation.active", { defaultValue: "已启用" })}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 pt-4">
            {rotationLoading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rotation ? (
              <>
                {/* Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>
                      {t("hermes.rotation.enable", {
                        defaultValue: "启用自动轮换",
                      })}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("hermes.rotation.enableHint", {
                        defaultValue:
                          "余额不足或 429 过多时自动切换到其他 Provider",
                      })}
                    </p>
                  </div>
                  <Switch
                    checked={rotation.enabled}
                    onCheckedChange={(checked) =>
                      saveRotation({ enabled: checked })
                    }
                    disabled={rotationSaving}
                  />
                </div>

                {/* Balance threshold */}
                <div className="space-y-2">
                  <Label htmlFor="rotation-balance">
                    {t("hermes.rotation.balanceThreshold", {
                      defaultValue: "余额阈值",
                    })}
                  </Label>
                  <Input
                    id="rotation-balance"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={rotation.balance_threshold ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                        ? parseFloat(e.target.value)
                        : undefined;
                      setRotation((prev) =>
                        prev
                          ? { ...prev, balance_threshold: val }
                          : prev,
                      );
                    }}
                    onBlur={() =>
                      saveRotation({
                        balance_threshold: rotation.balance_threshold,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("hermes.rotation.balanceHint", {
                      defaultValue:
                        "余额低于此值（美元）时触发轮换。设为 0 或留空禁用。",
                    })}
                  </p>
                </div>

                {/* 429 limit */}
                <div className="space-y-2">
                  <Label htmlFor="rotation-429-limit">
                    {t("hermes.rotation.rateLimit429", {
                      defaultValue: "429 上限",
                    })}
                  </Label>
                  <Input
                    id="rotation-429-limit"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="3"
                    value={rotation.rate_limit_429 ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                        ? parseInt(e.target.value, 10)
                        : undefined;
                      setRotation((prev) =>
                        prev
                          ? { ...prev, rate_limit_429: val }
                          : prev,
                      );
                    }}
                    onBlur={() =>
                      saveRotation({
                        rate_limit_429: rotation.rate_limit_429,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("hermes.rotation.rateLimitHint", {
                      defaultValue:
                        "连续 429 错误达到此数量时触发轮换。",
                    })}
                  </p>
                </div>

                {/* Rotation interval */}
                <div className="space-y-2">
                  <Label htmlFor="rotation-interval">
                    {t("hermes.rotation.interval", {
                      defaultValue: "轮询间隔（秒）",
                    })}
                  </Label>
                  <Input
                    id="rotation-interval"
                    type="number"
                    min={10}
                    step={10}
                    placeholder="60"
                    value={rotation.rotation_interval_seconds ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                        ? parseInt(e.target.value, 10)
                        : undefined;
                      setRotation((prev) =>
                        prev
                          ? {
                              ...prev,
                              rotation_interval_seconds: val,
                            }
                          : prev,
                      );
                    }}
                    onBlur={() =>
                      saveRotation({
                        rotation_interval_seconds:
                          rotation.rotation_interval_seconds,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("hermes.rotation.intervalHint", {
                      defaultValue:
                        "自动检查余额和 429 状态的时间间隔。",
                    })}
                  </p>
                </div>

                {/* 429 counts list */}
                {counts429.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      {t("hermes.rotation.counts429", {
                        defaultValue: "429 计数",
                      })}
                    </Label>
                    <div className="rounded-md border divide-y">
                      {counts429.map((item) => (
                        <div
                          key={item.provider}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <span className="truncate">{item.provider}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                item.count > 0
                                  ? "font-mono text-amber-600 dark:text-amber-400"
                                  : "font-mono text-muted-foreground"
                              }
                            >
                              {item.count}
                            </span>
                            {item.last_at && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.last_at).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rotate now button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleRotateNow}
                  disabled={rotating}
                >
                  <RotateCw
                    className={`mr-2 h-4 w-4 ${rotating ? "animate-spin" : ""}`}
                  />
                  {rotating
                    ? t("hermes.rotation.rotating", {
                        defaultValue: "轮换中…",
                      })
                    : t("hermes.rotation.rotateNow", {
                        defaultValue: "立即轮换",
                      })}
                </Button>
              </>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
