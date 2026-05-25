import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Cpu } from "lucide-react";
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

export function ParseResult({ result, onOpenInBuilder }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!result.success) return null;

  const bit55 = (result.fields ?? []).find((f) => f.bitNumber === 55);
  const onValidateInEmv = () => {
    if (!bit55) return;
    // Carry the PAN (bit 2, raw — not the masked displayValue) and detected brand
    // so the EMV tabs (Validate / Full Flow) come pre-populated.
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
