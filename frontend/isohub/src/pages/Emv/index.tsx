import * as Tabs from "@radix-ui/react-tabs";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { useEmvStore, type EmvTab } from "@/store/emv";
import { ParseBit55Tab } from "./ParseBit55Tab";
import { ValidateArqcTab } from "./ValidateArqcTab";
import { GenerateArqcTab } from "./GenerateArqcTab";
import { GenerateArpcTab } from "./GenerateArpcTab";
import { BuildResponseTab } from "./BuildResponseTab";
import { FullFlowTab } from "./FullFlowTab";

const TABS: { value: EmvTab; label: string; render: () => JSX.Element }[] = [
  { value: "parse", label: "Parse Bit 55", render: () => <ParseBit55Tab /> },
  { value: "validate", label: "Validate ARQC", render: () => <ValidateArqcTab /> },
  { value: "gen-arqc", label: "Generate ARQC", render: () => <GenerateArqcTab /> },
  { value: "gen-arpc", label: "Generate ARPC", render: () => <GenerateArpcTab /> },
  { value: "build", label: "Build Response", render: () => <BuildResponseTab /> },
  { value: "full-flow", label: "Full Flow", render: () => <FullFlowTab /> },
];

export default function EmvPage() {
  const { t } = useTranslation();
  const activeTab = useEmvStore((s) => s.activeTab);
  const setActiveTab = useEmvStore((s) => s.setActiveTab);

  return (
    <AppShell title={t("emv.title")} subtitle={t("emv.subtitle")}>
      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as EmvTab)}>
        <Tabs.List className="flex flex-wrap gap-1 mb-4 border-b border-[var(--border)]">
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-4 py-2 text-sm text-text-secondary border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-text-primary hover:text-text-primary transition-colors whitespace-nowrap"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {TABS.map((tab) => (
          <Tabs.Content key={tab.value} value={tab.value}>
            {tab.render()}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </AppShell>
  );
}
