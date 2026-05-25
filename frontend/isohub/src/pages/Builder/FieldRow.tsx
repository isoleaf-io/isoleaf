import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Edit3,
  Eye,
  EyeOff,
  Home,
  Pencil,
  RefreshCw,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { BuilderField, FieldOrigin } from "@/store/builder";
import { getFieldLabel } from "./fieldLabel";

const SENSITIVE_BITS = new Set([2, 14, 35, 45, 52]);

const ORIGIN_ICON: Record<FieldOrigin, { Icon: typeof Wand2; title: string }> = {
  generated: { Icon: Wand2, title: "Generated" },
  auto: { Icon: Zap, title: "Auto-filled" },
  workspace: { Icon: Home, title: "From Workspace" },
  manual: { Icon: Pencil, title: "Manual edit" },
  derived: { Icon: RefreshCw, title: "Derived from another field" },
};

interface Props {
  field: BuilderField;
  brand: string;
  /** Bits that depend on this one — drives the staleness explanation. */
  dependsOnLabels?: string;
  /** Only meaningful for bit 55 — toggles the EMV hint copy. */
  arqcIsSimulated?: boolean;
  onEdit: (newValue: string) => void;
  onRegenerate: () => void;
  onKeep: () => void;
  onRemove?: () => void;
}

export function FieldRow({ field, brand, dependsOnLabels, arqcIsSimulated, onEdit, onRegenerate, onKeep, onRemove }: Props) {
  const isSensitive = SENSITIVE_BITS.has(field.bitNumber);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);

  const display = isSensitive && !revealed ? field.displayValue : field.value;
  const { Icon: OriginIcon, title: originTitle } = ORIGIN_ICON[field.origin] ?? ORIGIN_ICON.generated;
  const stale = field.status === "stale";

  const startEdit = () => {
    setDraft(field.value);
    setEditing(true);
  };

  const saveEdit = () => {
    onEdit(draft);
    setEditing(false);
  };

  return (
    <>
      <tr className={clsx("group hover:bg-bg-tertiary/40 transition-colors", stale && "bg-warning-bg/40")}>
        <td className="py-2 px-4 text-text-tertiary font-mono text-xs w-24 whitespace-nowrap">
          {getFieldLabel(brand, field.bitNumber)}
        </td>
        <td className="py-2 px-4 text-sm">{field.name}</td>
        <td className="py-2 px-4">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  else if (e.key === "Escape") setEditing(false);
                }}
                className="flex-1 h-8 px-2 text-[13px] font-mono rounded-md bg-bg-input border border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <Button size="sm" onClick={saveEdit}>
                <Check size={13} /> Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X size={13} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <MonoText className="flex-1 text-text-primary break-all">{display}</MonoText>
              {stale && <AlertTriangle size={14} className="text-warning shrink-0" />}
              {isSensitive && (
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  className="p-1 rounded text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  title={revealed ? "Hide" : "Reveal"}
                >
                  {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton value={field.value} size={13} />
              </span>
              <button
                type="button"
                onClick={startEdit}
                className="p-1 rounded text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit"
              >
                <Edit3 size={13} />
              </button>
            </div>
          )}
        </td>
        <td className="py-2 px-4">
          <span className="inline-flex items-center gap-1 text-xs text-text-tertiary" title={originTitle}>
            <OriginIcon size={13} />
            <span className="capitalize">{field.origin}</span>
            {field.locked && <Badge tone="accent" className="ml-1">locked</Badge>}
          </span>
        </td>
        <td className="py-2 px-4 w-12">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove field"
            >
              <Trash2 size={13} />
            </button>
          )}
        </td>
      </tr>

      {field.bitNumber === 90 && !editing && !stale && (
        <tr>
          <td colSpan={5} className="px-4 pb-2 pt-0">
            <div className="text-[11px] text-text-tertiary ml-24">
              ℹ Preencha com os dados reais da transação original: MTI original + STAN + DateTime + RRN
            </div>
          </td>
        </tr>
      )}

      {field.bitNumber === 55 && arqcIsSimulated !== undefined && !editing && !stale && (
        <tr>
          <td colSpan={5} className="px-4 pb-2 pt-0">
            <div className="text-[11px] text-text-tertiary ml-24">
              {arqcIsSimulated
                ? "ℹ ARQC gerado aleatoriamente. Configure IMK no Workspace para derivação criptográfica."
                : "✓ ARQC derivado criptograficamente via IMK do Workspace."}
            </div>
          </td>
        </tr>
      )}

      {stale && !editing && (
        <tr className="bg-warning-bg/30">
          <td colSpan={5} className="px-4 pb-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-warning-text">
              <AlertTriangle size={14} />
              <span className="flex-1">
                {dependsOnLabels
                  ? `${dependsOnLabels} foi alterado — ${field.name} pode estar inconsistente`
                  : "Contexto mudou — campo pode estar desatualizado"}
              </span>
              <Button size="sm" variant="primary" onClick={onRegenerate}>
                <RefreshCw size={12} /> Regenerar
              </Button>
              <Button size="sm" variant="secondary" onClick={onKeep}>
                <Check size={12} /> Manter assim
              </Button>
              <Button size="sm" variant="ghost" onClick={startEdit}>
                <Edit3 size={12} /> Editar
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
