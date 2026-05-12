import { Plus, Settings, Edit3, LayoutGrid, FileText, Box, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppId } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  activeApp: AppId;
  promptSupported: boolean;
  mcpSupported: boolean;
  skillsSupported: boolean;
  onSwitchApp: (app: AppId) => void;
  onOpenSettings: () => void;
  onEditModeToggle: () => void;
  onAddProvider: () => void;
  onOpenPrompts?: () => void;
  onOpenMcp?: () => void;
  onOpenSkills?: () => void;
  isEditMode: boolean;
}

export function BottomNav({
  activeApp,
  promptSupported,
  mcpSupported,
  skillsSupported,
  onSwitchApp,
  onOpenSettings,
  onEditModeToggle,
  onAddProvider,
  onOpenPrompts,
  onOpenMcp,
  onOpenSkills,
  isEditMode,
}: MobileNavProps) {
  const tabs = [
    {
      id: "claude" as AppId,
      label: "Apps",
      icon: LayoutGrid,
    },
    ...(promptSupported
      ? [
          {
            id: "prompts" as AppId,
            label: "Prompts",
            icon: FileText,
            onTap: onOpenPrompts,
          },
        ]
      : []),
    ...(mcpSupported
      ? [
          {
            id: "mcp" as AppId,
            label: "MCP",
            icon: Box,
            onTap: onOpenMcp,
          },
        ]
      : []),
    ...(skillsSupported
      ? [
          {
            id: "skills" as AppId,
            label: "Skills",
            icon: Wrench,
            onTap: onOpenSkills,
          },
        ]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 md:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            if (tab.onTap) {
              tab.onTap();
            } else {
              onSwitchApp(tab.id);
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors",
            activeApp === tab.id
              ? "text-blue-500 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
          )}
        >
          <tab.icon className="h-5 w-5" />
          <span>{tab.label}</span>
        </button>
      ))}

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEditModeToggle}
          title={isEditMode ? "Exit edit mode" : "Enter edit mode"}
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-xs",
            isEditMode
              ? "text-blue-500 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400",
          )}
        >
          <Edit3 className="h-5 w-5" />
          <span className="text-[10px]">Edit</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          title="Settings"
          className="flex flex-col items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400"
        >
          <Settings className="h-5 w-5" />
          <span className="text-[10px]">Settings</span>
        </Button>
        <Button
          size="icon"
          onClick={onAddProvider}
          title="Add provider"
          className="flex flex-col items-center justify-center gap-1 text-xs"
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px]">Add</span>
        </Button>
      </div>
    </nav>
  );
}