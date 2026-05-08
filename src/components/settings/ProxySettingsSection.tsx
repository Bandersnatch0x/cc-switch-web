import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  RotateCcw,
  Square,
  TestTube2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { settingsApi } from "@/lib/api";
import type {
  ProxyAppId,
  ProxyRecentLog,
  ProxySettings,
  ProxyStatus,
} from "@/types";

const PROXY_APPS: ProxyAppId[] = ["claude", "codex", "gemini", "opencode"];

interface ProxySettingsSectionProps {
  value: ProxySettings;
  onChange: (value: ProxySettings) => void;
}

export function ProxySettingsSection({
  value,
  onChange,
}: ProxySettingsSectionProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [recentLogs, setRecentLogs] = useState<ProxyRecentLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<
    | "load"
    | "start"
    | "stop"
    | "test"
    | `test:${ProxyAppId}`
    | "restore"
    | `takeover:${ProxyAppId}`
    | null
  >(null);

  const listenUrl = useMemo(() => {
    if (status?.listenUrl) return status.listenUrl;
    return `http://${value.host || "127.0.0.1"}:${value.port || 3456}`;
  }, [status?.listenUrl, value.host, value.port]);

  const loadStatus = useCallback(async () => {
    setBusyAction((current) => current ?? "load");
    try {
      setStatus(await settingsApi.getProxyStatus());
    } catch (error) {
      console.warn("Failed to load proxy status", error);
    } finally {
      setBusyAction((current) => (current === "load" ? null : current));
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const update = (updates: Partial<ProxySettings>) => {
    onChange({ ...value, ...updates });
  };

  const updateApp = (
    app: ProxyAppId,
    updates: Partial<ProxySettings["apps"][ProxyAppId]>,
  ) => {
    onChange({
      ...value,
      apps: {
        ...value.apps,
        [app]: {
          ...value.apps[app],
          ...updates,
        },
      },
    });
  };

  const loadRecentLogs = async () => {
    setLogsLoading(true);
    try {
      setRecentLogs(await settingsApi.getProxyRecentLogs());
    } catch (error) {
      console.warn("Failed to load proxy recent logs", error);
      setRecentLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleLogs = async () => {
    const nextOpen = !logsOpen;
    setLogsOpen(nextOpen);
    if (nextOpen) {
      await loadRecentLogs();
    }
  };

  const validateBeforeStart = () => {
    if (!value.host.trim()) {
      toast.error(
        t("settings.proxy.validation.hostRequired", {
          defaultValue: "请输入代理监听地址",
        }),
      );
      return false;
    }
    if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535) {
      toast.error(
        t("settings.proxy.validation.portInvalid", {
          defaultValue: "代理端口必须在 1-65535 之间",
        }),
      );
      return false;
    }
    if (value.host.trim() === "0.0.0.0" && !value.enabled) {
      toast.error(
        t("settings.proxy.validation.publicBindRequiresEnable", {
          defaultValue: "监听 0.0.0.0 前请先启用代理并确认风险",
        }),
      );
      return false;
    }
    return true;
  };

  const handleStart = async () => {
    if (!validateBeforeStart()) return;
    if (status?.running) {
      await loadStatus();
      toast.info(
        t("settings.proxy.alreadyRunning", {
          defaultValue: "代理已在运行",
        }),
      );
      return;
    }
    setBusyAction("start");
    try {
      const nextStatus = await settingsApi.startProxy({
        ...value,
        enabled: true,
      });
      update({ enabled: true });
      setStatus(nextStatus);
      toast.success(
        t("settings.proxy.started", { defaultValue: "代理已启动" }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        t("settings.proxy.startFailed", { defaultValue: "代理启动失败" }),
        { description: message },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleStop = async () => {
    setBusyAction("stop");
    try {
      const nextStatus = await settingsApi.stopProxy();
      update({ enabled: false });
      setStatus(nextStatus);
      toast.success(
        t("settings.proxy.stopped", { defaultValue: "代理已停止" }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        t("settings.proxy.stopFailed", { defaultValue: "代理停止失败" }),
        { description: message },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestore = async () => {
    setBusyAction("restore");
    try {
      const nextStatus = await settingsApi.restoreProxy();
      onChange({
        ...value,
        liveTakeoverActive: false,
        apps: Object.fromEntries(
          PROXY_APPS.map((app) => [
            app,
            { ...value.apps[app], enabled: false },
          ]),
        ) as ProxySettings["apps"],
      });
      setStatus(nextStatus);
      toast.success(
        t("settings.proxy.restored", { defaultValue: "接管配置已恢复" }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        t("settings.proxy.restoreFailed", {
          defaultValue: "恢复接管配置失败",
        }),
        { description: message },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleTakeoverChange = async (app: ProxyAppId, enabled: boolean) => {
    updateApp(app, { enabled });
    setBusyAction(`takeover:${app}`);
    try {
      const result = await settingsApi.setProxyTakeover(app, enabled);
      setStatus(result.status);
      toast.success(
        enabled
          ? t("settings.proxy.takeoverEnabled", {
              defaultValue: "接管已开启",
            })
          : t("settings.proxy.takeoverDisabled", {
              defaultValue: "接管已关闭",
            }),
        { description: t(`apps.${app}`, { defaultValue: app }) },
      );
    } catch (error) {
      updateApp(app, { enabled: !enabled });
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        t("settings.proxy.takeoverFailed", {
          defaultValue: "更新接管状态失败",
        }),
        { description: message },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleTest = async (app?: ProxyAppId) => {
    const testApp = app ?? (value.bindApp as ProxyAppId);
    setBusyAction(app ? `test:${app}` : "test");
    try {
      const result = await settingsApi.testProxy({
        ...value,
        bindApp: testApp,
      });
      toast.success(
        t("settings.proxy.testSuccess", { defaultValue: "代理配置有效" }),
        {
          description:
            result.baseUrl ||
            t("settings.proxy.testedApp", {
              defaultValue: "已测试当前客户端",
              app: t(`apps.${testApp}`, { defaultValue: testApp }),
            }) ||
            result.message,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        t("settings.proxy.testFailed", { defaultValue: "代理配置无效" }),
        { description: message },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const isBusy = busyAction !== null;
  const isRunning = status?.running ?? false;
  const bindAppName = t(`apps.${value.bindApp}`, {
    defaultValue: value.bindApp,
  });

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">
            {t("settings.proxy.title", { defaultValue: "本地代理" })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("settings.proxy.description", {
              defaultValue:
                "为 Web/headless 模式启动本地 HTTP 转发代理，并使用当前供应商凭据转发请求。",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isRunning
              ? t("settings.proxy.running", { defaultValue: "运行中" })
              : t("settings.proxy.stoppedStatus", { defaultValue: "已停止" })}
          </span>
          <Switch
            checked={value.enabled}
            onCheckedChange={(checked) => update({ enabled: checked })}
            aria-label={t("settings.proxy.enabled", {
              defaultValue: "启用代理",
            })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">
            {t("settings.proxy.listen", { defaultValue: "监听地址" })}
          </div>
          <div className="mt-1 truncate text-sm font-medium">{listenUrl}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">
            {t("settings.proxy.requests", { defaultValue: "请求数" })}
          </div>
          <div className="mt-1 text-sm font-medium">
            {status?.totalRequests ?? 0}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">
            {t("settings.proxy.successRate", { defaultValue: "成功率" })}
          </div>
          <div className="mt-1 text-sm font-medium">
            {status?.successRate ?? 0}%
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">
            {t("settings.proxy.uptime", { defaultValue: "运行时长" })}
          </div>
          <div className="mt-1 text-sm font-medium">
            {status?.uptimeSeconds ?? 0}s
          </div>
        </div>
      </div>

      {status?.failoverCount ? (
        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("settings.proxy.failover", { defaultValue: "故障切换" })}
          </span>
          <span className="ml-2">
            {status.failoverCount}
            {status.lastFailoverFrom && status.lastFailoverTo
              ? ` · ${status.lastFailoverFrom} -> ${status.lastFailoverTo}`
              : null}
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cc-switch-proxy-host">
            {t("settings.proxy.host", { defaultValue: "监听地址" })}
          </Label>
          <Input
            id="cc-switch-proxy-host"
            value={value.host}
            onChange={(event) => update({ host: event.target.value })}
            placeholder="127.0.0.1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cc-switch-proxy-port">
            {t("settings.proxy.port", { defaultValue: "端口" })}
          </Label>
          <Input
            id="cc-switch-proxy-port"
            type="number"
            min={1}
            max={65535}
            value={value.port}
            onChange={(event) =>
              update({ port: Number(event.target.value) || 3456 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cc-switch-proxy-upstream">
            {t("settings.proxy.upstreamProxy", {
              defaultValue: "上游代理",
            })}
          </Label>
          <Input
            id="cc-switch-proxy-upstream"
            value={value.upstreamProxy ?? ""}
            onChange={(event) =>
              update({ upstreamProxy: event.target.value || undefined })
            }
            placeholder="http://127.0.0.1:7890"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={value.autoStart}
          onCheckedChange={(checked) => update({ autoStart: checked })}
        />
        <span>
          {t("settings.proxy.autoStart", {
            defaultValue: "随 Web server 启动",
          })}
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={value.enableLogging}
          onCheckedChange={(checked) => update({ enableLogging: checked })}
        />
        <span>
          {t("settings.proxy.enableLogging", {
            defaultValue: "记录最近请求状态",
          })}
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cc-switch-proxy-first-byte">
            {t("settings.proxy.firstByteTimeout", {
              defaultValue: "首字超时（秒）",
            })}
          </Label>
          <Input
            id="cc-switch-proxy-first-byte"
            type="number"
            min={1}
            value={value.streamingFirstByteTimeout}
            onChange={(event) =>
              update({
                streamingFirstByteTimeout: Number(event.target.value) || 90,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cc-switch-proxy-idle">
            {t("settings.proxy.idleTimeout", {
              defaultValue: "流式 idle 超时（秒）",
            })}
          </Label>
          <Input
            id="cc-switch-proxy-idle"
            type="number"
            min={1}
            value={value.streamingIdleTimeout}
            onChange={(event) =>
              update({
                streamingIdleTimeout: Number(event.target.value) || 120,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cc-switch-proxy-total">
            {t("settings.proxy.nonStreamingTimeout", {
              defaultValue: "非流式总超时（秒）",
            })}
          </Label>
          <Input
            id="cc-switch-proxy-total"
            type="number"
            min={1}
            value={value.nonStreamingTimeout}
            onChange={(event) =>
              update({ nonStreamingTimeout: Number(event.target.value) || 180 })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <h4 className="text-sm font-medium">
            {t("settings.proxy.takeover", { defaultValue: "应用接管" })}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t("settings.proxy.takeoverDescription", {
              defaultValue:
                "选择要被 cc-switch-web 修改配置的客户端。开启后，该客户端会被写入本地代理地址；停止或恢复时会还原原配置。",
            })}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROXY_APPS.map((app) => {
            const target = status?.activeTargets?.find(
              (item) => item.appType === app,
            );
            const busy = busyAction === `takeover:${app}`;
            const testBusy = busyAction === `test:${app}`;
            const appName = t(`apps.${app}`, { defaultValue: app });
            return (
              <div
                key={app}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {appName}
                    {app === "opencode" ? (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                        {t("settings.proxy.experimental", {
                          defaultValue: "实验性",
                        })}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {target?.providerName ??
                      t("settings.proxy.providerHidden", {
                        defaultValue: "使用当前供应商，API key 不显示",
                      })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(`settings.proxy.takeoverHint.${app}`, {
                      defaultValue: `${appName} 接管：让 ${appName} 走本地代理`,
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleTest(app)}
                    disabled={isBusy && !testBusy}
                    className="gap-1"
                  >
                    {testBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <TestTube2 className="h-3.5 w-3.5" />
                    )}
                    {t("settings.proxy.testApp", {
                      defaultValue: `测试 ${appName}`,
                      app: appName,
                    })}
                  </Button>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <Switch
                    checked={value.apps[app]?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      void handleTakeoverChange(app, checked)
                    }
                    disabled={isBusy && !busy}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed p-3 opacity-70">
            <div>
              <div className="text-sm font-medium">
                {t("apps.omo", { defaultValue: "OMO" })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("settings.proxy.omoUnsupported", {
                  defaultValue: "暂不支持代理接管",
                })}
              </div>
            </div>
            <Switch checked={false} disabled />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <div>
          <h4 className="text-sm font-medium">
            {t("settings.proxy.advanced", { defaultValue: "高级设置" })}
          </h4>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              {t("settings.proxy.bindApp", {
                defaultValue: "默认绑定客户端",
              })}
            </Label>
            <Select
              value={value.bindApp}
              onValueChange={(app) => update({ bindApp: app as ProxyAppId })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROXY_APPS.map((app) => (
                  <SelectItem key={app} value={app}>
                    {t(`apps.${app}`, { defaultValue: app })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("settings.proxy.bindAppDescription", {
                defaultValue:
                  "当代理无法根据请求路径判断目标客户端时，默认按这个客户端的当前 provider 转发。普通用户一般不用改；如果你只测试某一个客户端，可以选成对应客户端。",
              })}
            </p>
          </div>
        </div>
      </div>

      {value.host.trim() === "0.0.0.0" ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("settings.proxy.publicBindWarning", {
            defaultValue:
              "当前会暴露到所有网卡。请只在可信内网或 TLS 反代后使用。",
          })}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleTest()}
          disabled={isBusy}
          className="gap-2"
        >
          {busyAction === "test" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube2 className="h-4 w-4" />
          )}
          {t("settings.proxy.test", {
            defaultValue: `测试绑定客户端：${bindAppName}`,
            app: bindAppName,
          })}
        </Button>
        <Button
          type="button"
          onClick={handleStart}
          disabled={isBusy}
          className="gap-2"
        >
          {busyAction === "start" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {t("settings.proxy.start", { defaultValue: "启动代理" })}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleStop}
          disabled={isBusy || !isRunning}
          className="gap-2"
        >
          {busyAction === "stop" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {t("settings.proxy.stop", { defaultValue: "停止代理" })}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleRestore}
          disabled={isBusy}
          className="gap-2"
        >
          {busyAction === "restore" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {t("settings.proxy.restore", { defaultValue: "恢复接管" })}
        </Button>
        <span className="text-xs text-muted-foreground">{listenUrl}</span>
      </div>

      {status?.lastError ? (
        <p className="text-xs text-red-500 dark:text-red-400">
          {status.lastError}
        </p>
      ) : null}

      <div className="rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
          onClick={() => void toggleLogs()}
          aria-expanded={logsOpen}
        >
          <span>
            {t("settings.proxy.recentLogs", {
              defaultValue: "最近请求",
            })}
          </span>
          {logsOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {logsOpen ? (
          <div className="border-t px-3 py-2">
            {logsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("settings.proxy.loadingLogs", {
                  defaultValue: "加载中",
                })}
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                {t("settings.proxy.noRecentLogs", {
                  defaultValue: "暂无最近请求",
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {recentLogs.slice(-5).map((log, index) => (
                  <div
                    key={`${log.at}-${index}`}
                    className="grid gap-1 text-xs sm:grid-cols-[80px_1fr_72px]"
                  >
                    <div className="font-medium">{log.method}</div>
                    <div className="truncate text-muted-foreground">
                      {log.app} {log.path}
                    </div>
                    <div className="text-muted-foreground">
                      {log.status ?? "-"} · {log.durationMs}ms
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
