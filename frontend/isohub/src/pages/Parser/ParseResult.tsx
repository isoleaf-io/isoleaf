import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { AlertCircle, ChevronDown, ChevronRight, Cpu, Lightbulb } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MonoText } from "@/components/ui/MonoText";
import { MtiBadge } from "@/components/shared/MtiBadge";
import { useEmvStore } from "@/store/emv";
import { FieldRow } from "./FieldRow";
import { BitmapDisplay } from "./BitmapDisplay";
import type { IsoParseResponse } from "@/types";

interface Props {
  result: IsoParseResponse;
  onOpenInBuilder?: () => void;
  /** Cleaned input string (post-separator-strip) — used to render the
   *  ASCII-equivalent block when a binary-hex parse fails. */
  cleanedInput?: string;
}

function badgesForBits(activeBits: number[]) {
  const set = new Set(activeBits);
  const badges: { tone: "accent" | "success" | "warning" | "neutral"; label: string }[] = [];
  if (set.has(55)) badges.push({ tone: "accent", label: "Chip · EMV" });
  if (set.has(52)) badges.push({ tone: "warning", label: "PIN" });
  if (set.has(35)) badges.push({ tone: "neutral", label: "Track 2" });
  if (!set.has(35) && !set.has(52) && !set.has(55)) badges.push({ tone: "neutral", label: "CNP" });
  return badges;
}

/** True when the cleaned input looks like a binary-hex string (all hex chars,
 *  even length, ≥ 8 chars for the MTI). */
function looksLikeBinaryHex(input: string | undefined): boolean {
  if (!input) return false;
  if (input.length < 8 || input.length % 2 !== 0) return false;
  return /^[0-9A-Fa-f]+$/.test(input);
}

/** Decode a hex string to its ASCII representation, replacing non-printables
 *  (<0x20 or >0x7E) with ".". Returns chunks of `lineWidth` chars for display. */
function hexToAsciiLines(hex: string, lineWidth = 64): string {
  const chars: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.substring(i, i + 2), 16);
    chars.push(b >= 0x20 && b <= 0x7E ? String.fromCharCode(b) : ".");
  }
  const ascii = chars.join("");
  const lines: string[] = [];
  for (let i = 0; i < ascii.length; i += lineWidth) {
    lines.push(ascii.substring(i, i + lineWidth));
  }
  return lines.join("\n");
}

export function ParseResult({ result, onOpenInBuilder, cleanedInput }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [asciiOpen, setAsciiOpen] = useState(false);

  // ── Failure path: structured error + partial fields + ASCII equivalent ──
  if (!result.success) {
    const partial = result.partialFields ?? [];
    const showAscii = looksLikeBinaryHex(cleanedInput);
    return (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger-bg p-4 text-danger-text">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">{t("parser.parseError")}: </span>
                {result.parseError?.message ?? result.error ?? t("common.error")}
                {result.parseError && (
                  <span className="ml-1 text-xs opacity-80">
                    [{result.parseError.field} @ pos {result.parseError.position}]
                  </span>
                )}
              </div>
              {result.parseError?.hint && (
                <div className="flex items-start gap-2 text-xs">
                  <Lightbulb size={14} className="mt-0.5 shrink-0" />
                  <span>{t("parser.parseErrorHint")}</span>
                </div>
              )}
            </div>
          </div>

          {partial.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span>{t("parser.partialFields", { count: partial.length })}</span>
                <Badge tone="warning">{t("parser.partialBadge")}</Badge>
              </div>
              <div className="overflow-hidden rounded-md border border-[var(--border)]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-bg-tertiary text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                      <th className="py-2 px-4 font-semibold">{t("parser.bit")}</th>
                      <th className="py-2 px-4 font-semibold">{t("parser.field")}</th>
                      <th className="py-2 px-4 font-semibold">{t("parser.value")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {partial
                      .slice()
                      .sort((a, b) => a.bitNumber - b.bitNumber)
                      .map((f) => (
                        <FieldRow
                          key={f.bitNumber}
                          bit={f.bitNumber}
                          name={f.name}
                          value={f.value}
                          displayValue={f.displayValue}
                        />
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showAscii && cleanedInput && (
            <div className="rounded-md border border-[var(--border)] bg-bg-tertiary">
              <button
                type="button"
                onClick={() => setAsciiOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                {asciiOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {t("parser.asciiEquivalent")}
              </button>
              {asciiOpen && (
                <div className="border-t border-[var(--border)] px-3 py-2">
                  <p className="mb-2 text-xs text-text-tertiary">
                    {t("parser.asciiEquivalentHint")}
                  </p>
                  <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-text-primary">
                    {hexToAsciiLines(cleanedInput)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  // ── Success path (original behaviour) ──
  const bit55 = (result.fields ?? []).find((f) => f.bitNumber === 55);
  const onValidateInEmv = () => {
    if (!bit55) return;
    const panField = (result.fields ?? []).find((f) => f.bitNumber === 2);
    useEmvStore.getState().loadFromParser({
      hexBit55: bit55.value,
      pan: panField?.value,
      brand: result.detectedBrand ?? undefined,
    });
    navigate("/emv");
  };

  const bits = result.activeBits ?? [];
  const fields = result.fields ?? [];
  const exportJson = JSON.stringify(result, null, 2);
  const ctxBadges = badgesForBits(bits);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {result.mti && <MtiBadge mti={result.mti} />}
            <span className="text-sm text-text-tertiary">
              {fields.length} {t("parser.fields")}
            </span>
            {bits.length > 0 && (
              <span className="text-xs text-text-tertiary">
                {bits.length} {t("parser.bitmap")}
              </span>
            )}
            {result.tpdu && (
              <Badge tone="warning">
                TPDU: <MonoText className="ml-1">{result.tpdu.hex}</MonoText>
              </Badge>
            )}
            {result.lengthPrefix && (
              <Badge tone={result.lengthPrefix.match ? "success" : "warning"}>
                {result.lengthPrefix.match
                  ? t("parser.lengthPrefixOk", {
                      hex: result.lengthPrefix.hex,
                      bytes: result.lengthPrefix.expectedLength,
                    })
                  : t("parser.lengthPrefixMismatch", {
                      hex: result.lengthPrefix.hex,
                      expected: result.lengthPrefix.expectedLength,
                      actual: result.lengthPrefix.actualLength,
                    })}
              </Badge>
            )}
            {ctxBadges.map((b, i) => (
              <Badge key={i} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
            <Badge tone="success">{t("common.valid")}</Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const blob = new Blob([exportJson], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `iso8583-${result.mti ?? "parsed"}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {t("common.export")}
            </Button>
            {onOpenInBuilder && (
              <Button variant="secondary" size="sm" onClick={onOpenInBuilder}>
                {t("parser.openInBuilder")}
              </Button>
            )}
            {bit55 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onValidateInEmv}
                title="Carrega o Bit 55 na tela Dados EMV"
              >
                <Cpu size={13} /> Validar no EMV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="overflow-hidden rounded-md border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-tertiary text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="py-2 px-4 font-semibold">{t("parser.bit")}</th>
                <th className="py-2 px-4 font-semibold">{t("parser.field")}</th>
                <th className="py-2 px-4 font-semibold">{t("parser.value")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {fields
                .slice()
                .sort((a, b) => a.bitNumber - b.bitNumber)
                .map((f) => (
                  <FieldRow
                    key={f.bitNumber}
                    bit={f.bitNumber}
                    name={f.name}
                    value={f.value}
                    displayValue={f.displayValue}
                  />
                ))}
            </tbody>
          </table>
        </div>
        <BitmapDisplay activeBits={bits} hasSecondary={!!result.hasSecondaryBitmap} />
      </CardBody>
    </Card>
  );
}
