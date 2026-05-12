import { useTranslation } from "react-i18next";
import { Terminal, Blocks, Code2 } from "lucide-react";
import type { AppId } from "@/lib/api";
import { PROVIDER_APPS } from "@/config/apps";
import { ClaudeIcon, CodexIcon, GeminiIcon } from "@/components/BrandIcons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgentSidebarProps {
  activeApp: string;
  onAppSelect: (app: AppId) => void;
  isPlugin: boolean;
  onTerminalClick: () => void;
}

function renderAppIcon(appId: string, size = 18) {
  switch (appId) {
    case "claude":
      return <ClaudeIcon size={size} />;
    case "codex":
      return <CodexIcon size={size} />;
    case "gemini":
      return <GeminiIcon size={size} />;
    case "opencode":
      return <Code2 size={size} />;
    default:
      return <Blocks size={size} />;
  }
}

export function AgentSidebar({
  activeApp,
  onAppSelect,
  isPlugin,
  onTerminalClick,
}: AgentSidebarProps) {
  const { t } = useTranslation();

  const visibleApps = isPlugin
    ? PROVIDER_APPS.filter((id) => id === "hermes")
    : [...PROVIDER_APPS];

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
        "w-16 lg:w-64 shrink-0",
      )}
    >
      {/* App list */}
      <nav className="flex-1 overflow-y-auto p-2 lg:p-3">
        <ul className="flex flex-col gap-1">
          {visibleApps.map((appId) => {
            const isActive = activeApp === appId;
            return (
              <li key={appId}>
                <Button
                  variant="ghost"
                  onClick={() => onAppSelect(appId)}
                  className={cn(
                    "w-full justify-start gap-3 text-sm font-medium",
                    "h-10 px-0 lg:px-3",
                    isActive
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                    {renderAppIcon(appId)}
                  </span>
                  <span className="hidden lg:inline truncate">
                    {t(`apps.${appId}`, { defaultValue: appId })}
                  </span>
                  {isActive && (
                    <Badge
                      variant="default"
                      className="ml-auto hidden lg:inline-flex"
                    >
                      ✓
                    </Badge>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section — Remote Terminal */}
      <div className="border-t border-gray-200 p-2 lg:p-3 dark:border-gray-800">
        <Button
          variant="ghost"
          onClick={onTerminalClick}
          className="w-full justify-start gap-3 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 h-10 px-0 lg:px-3"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <Terminal size={18} />
          </span>
          <span className="hidden lg:inline">
            {t("terminal.title", { defaultValue: "远程终端" })}
          </span>
        </Button>
      </div>
    </aside>
  );
}
