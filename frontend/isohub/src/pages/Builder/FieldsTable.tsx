import { useTranslation } from "react-i18next";
import { Dices, Plus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MonoText } from "@/components/ui/MonoText";
import type { BuilderField } from "@/store/builder";
import { dependsOn } from "./fieldDependencies";
import { FieldRow } from "./FieldRow";
import { getFieldLabel } from "./fieldLabel";

interface Props {
  fields: BuilderField[];
  brand: string;
  bitmap?: string;
  /** Drives the EMV hint shown under bit 55. Undefined → bit 55 not present. */
  arqcIsSimulated?: boolean;
  onEditField: (bit: number, value: string) => void;
  onRegenerateField: (bit: number) => void;
  onKeepField: (bit: number) => void;
  onRemoveField: (bit: number) => void;
  onRegenerateCard: () => void;
  onAddField: () => void;
}

export function FieldsTable({
  fields,
  brand,
  bitmap,
  arqcIsSimulated,
  onEditField,
  onRegenerateField,
  onKeepField,
  onRemoveField,
  onRegenerateCard,
  onAddField,
}: Props) {
  const { t } = useTranslation();
  const sorted = fields.slice().sort((a, b) => a.bitNumber - b.bitNumber);
  const fieldByBit = new Map(sorted.map((f) => [f.bitNumber, f]));

  const labelForDeps = (bit: number) =>
    dependsOn(bit)
      .map((p) => fieldByBit.get(p)?.name ?? getFieldLabel(brand, p))
      .join(", ");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">
              {t("builder.fieldsCount", { count: sorted.length })}
            </span>
            {bitmap && (
              <span className="text-text-tertiary">
                · Bitmap <MonoText className="text-text-mono">{bitmap}</MonoText>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onRegenerateCard}>
              <Dices size={13} /> {t("builder.newCard")}
            </Button>
            <Button variant="secondary" size="sm" onClick={onAddField}>
              <Plus size={13} /> {t("builder.addField")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-tertiary text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="py-2 px-4 font-semibold w-24">{t("builder.table.label")}</th>
                <th className="py-2 px-4 font-semibold">{t("builder.table.field")}</th>
                <th className="py-2 px-4 font-semibold">{t("builder.table.value")}</th>
                <th className="py-2 px-4 font-semibold w-32">{t("builder.table.origin")}</th>
                <th className="py-2 px-4 font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sorted.map((f) => (
                <FieldRow
                  key={f.bitNumber}
                  field={f}
                  brand={brand}
                  dependsOnLabels={labelForDeps(f.bitNumber)}
                  arqcIsSimulated={f.bitNumber === 55 ? arqcIsSimulated : undefined}
                  onEdit={(v) => onEditField(f.bitNumber, v)}
                  onRegenerate={() => onRegenerateField(f.bitNumber)}
                  onKeep={() => onKeepField(f.bitNumber)}
                  onRemove={() => onRemoveField(f.bitNumber)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
