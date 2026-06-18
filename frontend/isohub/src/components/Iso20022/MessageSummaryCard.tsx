import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { StatementEntriesAccordion } from "@/components/Iso20022/StatementEntriesAccordion";
import type { MessageSummary } from "@/api/iso20022";

interface Props {
  messageType: string;
  summary: MessageSummary;
}

type Tone = "success" | "warning" | "neutral";

interface ConfidenceConfig {
  labelKey: string;
  tone: Tone;
}

const CONFIDENCE: Record<MessageSummary["confidence"], ConfidenceConfig> = {
  full:    { labelKey: "iso20022.summary.confidence.full",    tone: "success" },
  partial: { labelKey: "iso20022.summary.confidence.partial", tone: "warning" },
  unknown: { labelKey: "iso20022.summary.confidence.unknown", tone: "neutral" },
};

/**
 * Human-friendly header for a parsed ISO 20022 message: shows the operation
 * name, a confidence badge and a grid of the key fields. Missing fields are
 * still rendered (with a "não encontrado" placeholder) so users can see at
 * a glance what the extractor expected to find.
 */
export function MessageSummaryCard({ messageType, summary }: Props) {
  const { t } = useTranslation();
  const conf = CONFIDENCE[summary.confidence] ?? CONFIDENCE.unknown;

  return (
    <Card data-testid="iso20022-summary-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap w-full">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <Badge tone="accent">{messageType}</Badge>
            <span className="text-sm font-semibold truncate" title={summary.operation}>
              {summary.operation}
            </span>
          </div>
          <Badge tone={conf.tone}>{t(conf.labelKey)}</Badge>
        </div>
      </CardHeader>

      {summary.confidence === "unknown" ? (
        <div className="px-4 py-4 text-sm text-text-secondary">
          {t("iso20022.summary.unknownHint")}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)]"
        >
          {summary.fields.map((field, i) => (
            <div
              key={`${field.label}-${i}`}
              className="bg-bg-primary px-3 py-2.5"
              data-testid={`iso20022-summary-field-${i}`}
            >
              <div className="text-[11px] text-text-tertiary mb-0.5 uppercase tracking-wide">
                {field.label}
              </div>
              {field.found && field.value ? (
                <MonoText className="text-sm text-text-primary break-all">
                  {field.value}
                </MonoText>
              ) : (
                <div
                  className={clsx("text-sm italic text-text-tertiary")}
                  data-testid="iso20022-summary-field-missing"
                >
                  {t("iso20022.summary.notFound")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* camt.053 statement entries — collapsed by default so the summary stays
          compact when an extract carries dozens of bookings. */}
      {summary.entries && summary.entries.length > 0 && (
        <div className="border-t border-[var(--border)] p-3">
          <StatementEntriesAccordion entries={summary.entries} />
        </div>
      )}
    </Card>
  );
}
