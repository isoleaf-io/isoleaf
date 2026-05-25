import { ReactNode } from "react";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Inline page header — replaces the previous global Topbar.
 * Each page renders this at the top of its content; theme + language live here.
 */
export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-[15px] font-medium text-text-primary truncate">{title}</span>
        {subtitle && (
          <span className="text-xs text-text-secondary truncate">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </div>
  );
}
