import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, X } from "lucide-react";
import { useAppConfig } from "@/contexts/AppConfigContext";

const DISMISS_KEY = "isoleaf-online-banner-dismissed";

/**
 * Top-of-page banner shown only when the backend reports mode=online.
 * Dismissal is sessionStorage-scoped so it returns on a new tab.
 */
export function OnlineBanner() {
  const { t } = useTranslation();
  const { mode } = useAppConfig();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return window.sessionStorage.getItem(DISMISS_KEY) === "1"; }
    catch { return false; }
  });

  if (mode !== "online" || dismissed) return null;

  const dismiss = () => {
    try { window.sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="flex items-center gap-3 px-4 py-2 bg-accent-bg/40 border-b border-accent/30 text-accent-text text-xs"
    >
      <Cloud size={14} className="shrink-0" />
      <span className="flex-1">
        {t("online.banner.text")}{" "}
        <a
          href="https://github.com/isoleaf-io/isoleaf#readme"
          target="_blank"
          rel="noreferrer"
          className="underline font-medium hover:opacity-80"
        >
          {t("online.banner.installLink")}
        </a>
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.close")}
        className="p-1 rounded hover:bg-accent-bg/60 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
