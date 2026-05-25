import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/store/theme";

export function ThemeToggle() {
  const { mode, cycle } = useThemeStore();
  const { t } = useTranslation();

  const Icon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const label = t(`common.theme.${mode}`);

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-bg-input text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
    >
      <Icon size={16} />
    </button>
  );
}
