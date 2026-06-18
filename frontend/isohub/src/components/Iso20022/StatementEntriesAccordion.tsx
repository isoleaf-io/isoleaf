import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { MonoText } from "@/components/ui/MonoText";
import type { StatementEntry } from "@/api/iso20022";

interface Props {
  entries: StatementEntry[];
}

/**
 * Collapsible table of camt.053 statement entries (<c>&lt;Ntry&gt;</c>). The
 * collapsed state keeps the message summary compact when a statement has
 * dozens of rows; the expanded table follows the existing ISOLeaf palette
 * (no separate dark-theme tokens).
 */
export function StatementEntriesAccordion({ entries }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div
      className="rounded-md border border-[var(--border)] overflow-hidden"
      data-testid="iso20022-entries-accordion"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-secondary hover:bg-bg-tertiary transition-colors text-left"
        aria-expanded={open}
        data-testid="iso20022-entries-toggle"
      >
        <span className="text-sm font-medium flex items-center gap-2">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {t("iso20022.entries.count", { count: entries.length })}
        </span>
        <span className="text-xs text-text-tertiary">
          {t("iso20022.entries.toggleHint")}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto" data-testid="iso20022-entries-table">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  {t("iso20022.entries.col.date")}
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  {t("iso20022.entries.col.amount")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  {t("iso20022.entries.col.direction")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  {t("iso20022.entries.col.status")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  {t("iso20022.entries.col.endToEndId")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  {t("iso20022.entries.col.description")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const isCredit = e.creditDebitIndicator === "CRDT";
                const isDebit = e.creditDebitIndicator === "DBIT";
                return (
                  <tr
                    key={i}
                    className="border-b border-[var(--border)] last:border-b-0 hover:bg-bg-secondary/50"
                    data-testid={`iso20022-entry-row-${i}`}
                  >
                    <td className="px-3 py-2 font-mono text-text-secondary whitespace-nowrap">
                      {e.bookingDate ?? "—"}
                    </td>
                    <td
                      className={clsx(
                        "px-3 py-2 font-mono text-right whitespace-nowrap font-medium",
                        isCredit && "text-success-text",
                        isDebit && "text-danger-text",
                        !isCredit && !isDebit && "text-text-secondary",
                      )}
                      data-testid={`iso20022-entry-amount-${i}`}
                    >
                      {isDebit ? "-" : isCredit ? "+" : ""}
                      {e.amount ?? "—"}
                      {e.currency && (
                        <span className="text-text-tertiary ml-1 text-xs">
                          {e.currency}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {e.creditDebitIndicator ? (
                        <span
                          className={clsx(
                            "text-xs px-1.5 py-0.5 rounded font-mono font-medium",
                            isCredit && "bg-success-bg text-success-text",
                            isDebit && "bg-danger-bg text-danger-text",
                            !isCredit && !isDebit && "bg-bg-tertiary text-text-secondary",
                          )}
                        >
                          {e.creditDebitIndicator}
                        </span>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-text-secondary">
                      {e.status ?? "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-xs font-mono text-text-secondary max-w-[12rem] truncate"
                      title={e.endToEndId ?? undefined}
                    >
                      {e.endToEndId ? <MonoText>{e.endToEndId}</MonoText> : "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-xs text-text-secondary max-w-[16rem] truncate"
                      title={e.remittanceInfo ?? undefined}
                    >
                      {e.remittanceInfo ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
