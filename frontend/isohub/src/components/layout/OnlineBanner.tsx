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
  const { t, i18n } = useTranslation();
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

  // Sprint 12.7 P3: point at the Quick Start matrix (three-options index)
  // that sits at the top of the `guides` section. The slug comes from the
  // docs-site slugify() run over each language's H2 text — asymmetric on
  // purpose, one slug per locale. Language suffix mirrors what
  // pages/Docs/index.tsx does for its cards.
  const lang = i18n.language?.startsWith("pt") ? "pt" : "en";
  const quickStartSlug =
    lang === "pt"
      ? "quick-start-tres-formas-de-rodar"
      : "quick-start-three-ways-to-run";
  const installHref = `https://docs.isoleaf.dev/${lang}/#guides/${quickStartSlug}`;

  return (
    <div
      role="status"
      className="flex items-center gap-3 px-4 py-2 bg-accent-bg/40 border-b border-accent/30 text-accent-text text-xs"
    >
      <Cloud size={14} className="shrink-0" />
      <span className="flex-1">
        {t("online.banner.text")}{" "}
        <a
          href={installHref}
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
