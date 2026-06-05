import * as Tabs from "@radix-ui/react-tabs";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@/components/layout/AppShell";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useEmvStore, type EmvTab } from "@/store/emv";
import { ParseBit55Tab } from "./ParseBit55Tab";
import { ValidateArqcTab } from "./ValidateArqcTab";
import { GenerateArqcTab } from "./GenerateArqcTab";
import { GenerateArpcTab } from "./GenerateArpcTab";
import { BuildResponseTab } from "./BuildResponseTab";
import { FullFlowTab } from "./FullFlowTab";

interface TabDef {
  value: EmvTab;
  label: string;
  render: () => JSX.Element;
  /** Requires IMK / crypto — replaced by the locked panel in online mode. */
  requiresCrypto: boolean;
}

const TABS: TabDef[] = [
  { value: "parse",     label: "Parse Bit 55",   render: () => <ParseBit55Tab />,    requiresCrypto: false },
  { value: "validate",  label: "Validate ARQC",  render: () => <ValidateArqcTab />,  requiresCrypto: true  },
  { value: "gen-arqc",  label: "Generate ARQC",  render: () => <GenerateArqcTab />,  requiresCrypto: true  },
  { value: "gen-arpc",  label: "Generate ARPC",  render: () => <GenerateArpcTab />,  requiresCrypto: true  },
  { value: "build",     label: "Build Response", render: () => <BuildResponseTab />, requiresCrypto: false },
  { value: "full-flow", label: "Full Flow",      render: () => <FullFlowTab />,      requiresCrypto: true  },
];

export default function EmvPage() {
  const { t } = useTranslation();
  const activeTab = useEmvStore((s) => s.activeTab);
  const setActiveTab = useEmvStore((s) => s.setActiveTab);
  const { emvCryptoEnabled } = useAppConfig();

  return (
    <AppShell title={t("emv.title")} subtitle={t("emv.subtitle")}>
      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as EmvTab)}>
        <Tabs.List className="flex flex-wrap gap-1 mb-4 border-b border-[var(--border)]">
          {TABS.map((tab) => {
            const locked = tab.requiresCrypto && !emvCryptoEnabled;
            return (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className={clsx(
                  "px-4 py-2 text-sm border-b-2 border-transparent transition-colors whitespace-nowrap inline-flex items-center gap-1.5",
                  locked
                    ? "text-text-tertiary"
                    : "text-text-secondary data-[state=active]:border-accent data-[state=active]:text-text-primary hover:text-text-primary",
                )}
                title={locked ? t("online.feature.unavailable") : undefined}
              >
                {locked && <Lock size={12} />}
                {tab.label}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        {TABS.map((tab) => {
          const locked = tab.requiresCrypto && !emvCryptoEnabled;
          return (
            <Tabs.Content key={tab.value} value={tab.value}>
              {locked ? <CryptoLockedPanel /> : tab.render()}
            </Tabs.Content>
          );
        })}
      </Tabs.Root>
    </AppShell>
  );
}

/**
 * Replaces a crypto-dependent EMV tab's content when running in online mode.
 * The tab itself stays selectable so users see why the feature is hidden.
 */
function CryptoLockedPanel() {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-warning/40 bg-warning-bg/30 text-warning-text p-6 max-w-2xl">
      <div className="flex items-start gap-3">
        <Lock size={20} className="mt-0.5 shrink-0" />
        <div className="space-y-3">
          <div className="text-base font-semibold">{t("online.feature.unavailable")}</div>
          <p className="text-sm leading-relaxed">{t("online.feature.reason")}</p>
          <a
            href="https://github.com/isoleaf-io/isoleaf#readme"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium underline hover:opacity-80"
          >
            {t("online.feature.installCta")}
          </a>
        </div>
      </div>
    </div>
  );
}
