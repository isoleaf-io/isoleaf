import { Info, RefreshCw, X } from "lucide-react";
import clsx from "clsx";
import type { BuildFieldDto } from "@/api/iso20022Builder";
import { getFieldLabel } from "@/config/iso20022FieldLabels";
import {
  generateFieldValue,
  isGeneratableField,
} from "@/utils/iso20022Generators";

interface Props {
  field: BuildFieldDto;
  value: string;
  onChange: (xpath: string, value: string) => void;
  /** When set, the row shows an X button that removes the field from the visible set. */
  onRemove?: (xpath: string) => void;
  /** Drives ecosystem-specific value generation (BCB Pix, CBPR+, T2…). */
  ecosystemId?: string;
  /**
   * Full value map keyed by XPath. Used by the currency editor to read the
   * paired `@Ccy` attribute since the server doesn't surface attributes as
   * standalone fields.
   */
  allValues?: Record<string, string>;
}

const CURRENCY_OPTIONS = ["BRL", "EUR", "USD", "GBP", "CHF", "JPY"];

function getCurrencyDefault(ecosystemId?: string): string {
  switch (ecosystemId) {
    case "brazilian-pix":
      return "BRL";
    case "sepa":
    case "target-t2":
      return "EUR";
    case "swift-cbpr":
      return "USD";
    default:
      return "USD";
  }
}

/**
 * One editable row in the Builder's section table. Shows the mandatory
 * indicator (XSD vs. ecosystem vs. optional), the field name, the editor
 * (select when the type has enumerations, input otherwise), and the type
 * + length hint on the right. Hints from the scenario surface as a tooltip
 * on the info icon.
 */
export function BuilderFieldRow({
  field,
  value,
  onChange,
  onRemove,
  ecosystemId,
  allValues,
}: Props) {
  const lengthHint = formatLengthHint(field.minLength, field.maxLength);
  const canRegenerate = isGeneratableField(field);
  const isCurrencyAmount = field.typeName.includes("CurrencyAndAmount");

  function handleRegenerate() {
    onChange(field.xpath, generateFieldValue(field, ecosystemId));
  }

  return (
    <tr
      className="border-b border-[var(--border)] last:border-b-0 transition-shadow"
      data-testid={`builder-field-${field.xpath}`}
      data-xpath={field.xpath}
    >
      {/* Mandatory marker */}
      <td className="py-1.5 pr-2 w-6 align-top">
        <MandatoryIcon field={field} />
      </td>

      {/* Name — friendly label on top, technical XSD name below */}
      <td className="py-1.5 pr-3 align-top">
        <div className="flex flex-col">
          <span
            className={clsx(
              "text-xs leading-tight inline-flex items-center gap-1",
              field.isMandatory || field.isEcosystemMandatory
                ? "font-semibold text-text-primary"
                : "text-text-secondary",
            )}
          >
            {getFieldLabel(field.name)}
            {field.hint && (
              <span title={field.hint} className="inline-flex align-middle">
                <Info size={11} className="text-accent-text" />
              </span>
            )}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary leading-tight">
            {field.name}
          </span>
        </div>
      </td>

      {/* Editor */}
      <td className="py-1.5 pr-3 align-top">
        <div className="flex items-center gap-1">
          {isCurrencyAmount ? (
            <CurrencyAmountEditor
              field={field}
              value={value}
              onChange={onChange}
              allValues={allValues}
              ecosystemId={ecosystemId}
            />
          ) : field.enumerations.length > 0 ? (
            <select
              value={value}
              onChange={(e) => onChange(field.xpath, e.target.value)}
              data-testid={`builder-input-${field.xpath}`}
              className="bg-bg-input border border-[var(--border)] rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent w-full"
            >
              {field.enumerations.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(field.xpath, e.target.value)}
              maxLength={field.maxLength ?? undefined}
              placeholder={field.value ?? ""}
              data-testid={`builder-input-${field.xpath}`}
              className="bg-bg-input border border-[var(--border)] rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent w-full"
            />
          )}
          {canRegenerate && (
            <button
              type="button"
              onClick={handleRegenerate}
              title="Regenerar valor"
              aria-label="Regenerar valor"
              data-testid={`builder-regenerate-${field.xpath}`}
              className="shrink-0 p-1 rounded text-text-tertiary hover:text-accent-text hover:bg-bg-tertiary transition-colors"
            >
              <RefreshCw size={12} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(field.xpath)}
              title="Remover campo opcional"
              aria-label="Remover campo opcional"
              data-testid={`builder-remove-field-${field.xpath}`}
              className="shrink-0 p-1 rounded text-text-tertiary hover:text-danger-text hover:bg-bg-tertiary transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </td>

      {/* Type + length */}
      <td className="py-1.5 align-top text-right whitespace-nowrap">
        <span className="text-[10px] font-mono text-text-tertiary">
          {field.typeName}
          {lengthHint && <span className="ml-1">{lengthHint}</span>}
        </span>
      </td>
    </tr>
  );
}

function MandatoryIcon({ field }: { field: BuildFieldDto }) {
  // Three states, three glyphs — terse so the column stays narrow.
  if (field.isEcosystemMandatory) {
    return (
      <span
        title="Obrigatório pelo ecossistema"
        className="text-warning-text font-bold"
        aria-label="ecosystem mandatory"
      >
        ★
      </span>
    );
  }
  if (field.isMandatory) {
    return (
      <span
        title="Obrigatório pelo XSD"
        className="text-accent-text font-bold"
        aria-label="mandatory"
      >
        ●
      </span>
    );
  }
  return (
    <span
      title="Opcional"
      className="text-text-tertiary"
      aria-label="optional"
    >
      ○
    </span>
  );
}

function CurrencyAmountEditor({
  field,
  value,
  onChange,
  allValues,
  ecosystemId,
}: {
  field: BuildFieldDto;
  value: string;
  onChange: (xpath: string, value: string) => void;
  allValues?: Record<string, string>;
  ecosystemId?: string;
}) {
  const ccyXPath = `${field.xpath}/@Ccy`;
  const ccyValue = allValues?.[ccyXPath] ?? getCurrencyDefault(ecosystemId);

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(field.xpath, e.target.value)}
        placeholder={field.value ?? "0.00"}
        data-testid={`builder-input-${field.xpath}`}
        className="bg-bg-input border border-[var(--border)] rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent flex-1"
      />
      <select
        value={ccyValue}
        onChange={(e) => onChange(ccyXPath, e.target.value)}
        data-testid={`builder-input-${ccyXPath}`}
        className="bg-bg-input border border-[var(--border)] rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent w-20"
      >
        {CURRENCY_OPTIONS.includes(ccyValue) ? null : (
          <option value={ccyValue}>{ccyValue}</option>
        )}
        {CURRENCY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </>
  );
}

function formatLengthHint(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `(${max})` : `(${min}-${max})`;
  }
  return max != null ? `(max ${max})` : `(min ${min})`;
}
