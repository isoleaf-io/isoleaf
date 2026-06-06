import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

/**
 * Rendered in place of the live Simulator UI when the backend reports
 * simulatorEnabled=false (online demo mode). Mirrors CryptoLockedPanel in
 * shape so the two locked screens feel consistent across the app.
 */
export function SimulatorLockedPanel() {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-warning/40 bg-warning-bg/30 text-warning-text p-6 max-w-2xl">
      <div className="flex items-start gap-3">
        <Lock size={20} className="mt-0.5 shrink-0" />
        <div className="space-y-3">
          <div className="text-base font-semibold">{t("simulator.lockedTitle")}</div>
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {t("simulator.lockedReason")}
          </p>
          <a
            href="https://github.com/isoleaf-io/isoleaf#readme"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium underline hover:opacity-80"
          >
            {t("simulator.lockedInstallCta")}
          </a>
        </div>
      </div>
    </div>
  );
}
