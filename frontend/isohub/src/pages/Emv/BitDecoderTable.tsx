import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import type { DecodedTag } from "./emvDecoders";

/**
 * Renders the per-tag bit-level decode (TVR, AIP, TSI, CVM results/list, TTQ,
 * CTQ, IAD). Switches on `decoded.kind` to pick the right layout — kept in a
 * single component so the EMV section always has a consistent look.
 */
export function BitDecoderTable({ decoded }: { decoded: DecodedTag }) {
  const { t } = useTranslation();
  if (decoded === null) return null;

  if (decoded.kind === "bits") {
    return (
      <div className="rounded-md border border-[var(--border)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-tertiary text-left text-[10px] uppercase tracking-wider text-text-tertiary">
              <th className="py-1.5 px-3 font-semibold w-20">{t("emv.bitDecoder.byte")}</th>
              <th className="py-1.5 px-3 font-semibold w-12">{t("emv.bitDecoder.bit")}</th>
              <th className="py-1.5 px-3 font-semibold">{t("emv.bitDecoder.description")}</th>
              <th className="py-1.5 px-3 font-semibold w-24 text-right">{t("emv.bitDecoder.value")}</th>
            </tr>
          </thead>
          <tbody>
            {decoded.bytes.map((byte) => (
              <Fragment key={byte.byteIndex}>
                <tr className="bg-bg-secondary/40 border-t border-[var(--border)]">
                  <td className="py-1 px-3 font-semibold text-text-secondary" colSpan={4}>
                    {t("emv.bitDecoder.byteHeader", { index: byte.byteIndex + 1 })}{" "}
                    <MonoText className="text-text-mono">0x{byte.byteHex}</MonoText>{" "}
                    <span className="text-text-tertiary">({byte.binary})</span>
                  </td>
                </tr>
                {byte.bits.map((row) => (
                  <tr
                    key={`b${byte.byteIndex}-${row.bit}`}
                    className={clsx(
                      "border-t border-[var(--border)]",
                      row.set && !row.rfu && "bg-accent-bg/20",
                    )}
                  >
                    <td className="py-1 px-3"></td>
                    <td className="py-1 px-3 text-text-tertiary font-mono">b{row.bit}</td>
                    <td className={clsx("py-1 px-3", row.rfu && "text-text-tertiary italic")}>
                      {row.label}
                    </td>
                    <td className="py-1 px-3 text-right">
                      {row.rfu ? (
                        <span className="text-text-tertiary text-[10px]">—</span>
                      ) : row.set ? (
                        <span className="text-success-text font-mono">1 ✓</span>
                      ) : (
                        <span className="text-text-tertiary font-mono">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (decoded.kind === "codes") {
    return (
      <div className="rounded-md border border-[var(--border)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-tertiary text-left text-[10px] uppercase tracking-wider text-text-tertiary">
              <th className="py-1.5 px-3 font-semibold w-40">{t("emv.bitDecoder.field")}</th>
              <th className="py-1.5 px-3 font-semibold w-16">{t("emv.bitDecoder.hex")}</th>
              <th className="py-1.5 px-3 font-semibold">{t("emv.bitDecoder.meaning")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {decoded.rows.map((row, i) => (
              <tr key={i}>
                <td className="py-1.5 px-3 font-medium">{row.label}</td>
                <td className="py-1.5 px-3"><MonoText className="text-text-mono">0x{row.byteHex}</MonoText></td>
                <td className="py-1.5 px-3">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (decoded.kind === "cvm-list") {
    return (
      <div className="space-y-2">
        <div className="flex gap-4 text-xs">
          <span><span className="text-text-tertiary">Amount X:</span> <MonoText className="text-text-mono">0x{decoded.amountX}</MonoText></span>
          <span><span className="text-text-tertiary">Amount Y:</span> <MonoText className="text-text-mono">0x{decoded.amountY}</MonoText></span>
        </div>
        <div className="rounded-md border border-[var(--border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bg-tertiary text-left text-[10px] uppercase tracking-wider text-text-tertiary">
                <th className="py-1.5 px-3 font-semibold w-12">#</th>
                <th className="py-1.5 px-3 font-semibold w-16">{t("emv.bitDecoder.rule")}</th>
                <th className="py-1.5 px-3 font-semibold">{t("emv.bitDecoder.cvmCode")}</th>
                <th className="py-1.5 px-3 font-semibold">{t("emv.bitDecoder.cvmCondition")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {decoded.rules.map((rule, i) => (
                <tr key={i}>
                  <td className="py-1.5 px-3 text-text-tertiary">{i + 1}</td>
                  <td className="py-1.5 px-3"><MonoText className="text-text-mono">0x{rule.ruleHex}</MonoText></td>
                  <td className="py-1.5 px-3">{rule.codeDesc}</td>
                  <td className="py-1.5 px-3">{rule.conditionDesc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (decoded.kind === "iad") {
    return (
      <div className="space-y-2">
        <Badge tone={decoded.format === "visa" ? "accent" : "warning"}>
          {decoded.format === "visa" ? t("emv.bitDecoder.iadVisa") : t("emv.bitDecoder.iadMastercard")}
        </Badge>
        <div className="rounded-md border border-[var(--border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bg-tertiary text-left text-[10px] uppercase tracking-wider text-text-tertiary">
                <th className="py-1.5 px-3 font-semibold w-16">{t("emv.bitDecoder.offset")}</th>
                <th className="py-1.5 px-3 font-semibold">{t("emv.bitDecoder.field")}</th>
                <th className="py-1.5 px-3 font-semibold w-32">{t("emv.bitDecoder.hex")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {decoded.fields.map((f, i) => (
                <tr key={i}>
                  <td className="py-1.5 px-3 font-mono text-text-tertiary">{f.offset}</td>
                  <td className="py-1.5 px-3">{f.label}</td>
                  <td className="py-1.5 px-3"><MonoText className="text-text-mono">0x{f.hex}</MonoText></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // kind === "iad-unknown"
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-warning/40 bg-warning-bg/30 p-3 text-xs text-warning-text">
        {t("emv.bitDecoder.iadUnknown")}
      </div>
      <div className="rounded-md border border-[var(--border)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-tertiary text-left text-[10px] uppercase tracking-wider text-text-tertiary">
              <th className="py-1.5 px-3 font-semibold w-16">{t("emv.bitDecoder.offset")}</th>
              <th className="py-1.5 px-3 font-semibold w-20">{t("emv.bitDecoder.hex")}</th>
              <th className="py-1.5 px-3 font-semibold">{t("emv.bitDecoder.binary")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {decoded.rawBytes.map((b) => (
              <tr key={b.offset}>
                <td className="py-1.5 px-3 font-mono text-text-tertiary">{b.offset}</td>
                <td className="py-1.5 px-3"><MonoText className="text-text-mono">0x{b.hex}</MonoText></td>
                <td className="py-1.5 px-3 font-mono text-text-tertiary">{b.binary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
