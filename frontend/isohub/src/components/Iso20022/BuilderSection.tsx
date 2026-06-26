import { useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import clsx from "clsx";
import { Badge } from "@/components/ui/Badge";
import { BuilderFieldRow } from "./BuilderFieldRow";
import { AddOptionalFieldButton } from "./AddOptionalFieldButton";
import type { BuildSectionDto } from "@/api/iso20022Builder";

interface Props {
  section: BuildSectionDto;
  values: Record<string, string>;
  onChange: (xpath: string, value: string) => void;
  /** XPaths of optional fields and sub-sections the user has chosen to show. */
  addedOptionalXPaths: Set<string>;
  onAddOptional: (xpath: string) => void;
  /** Removes a previously-added optional field/section. Mandatory entries cannot be removed. */
  onRemoveOptional: (xpath: string) => void;
  /** Drives ecosystem-specific value generation in descendant rows. */
  ecosystemId?: string;
  defaultExpanded?: boolean;
}

/**
 * Collapsible section in the Builder editor. Mandatory sections expand on
 * mount; optional ones start collapsed with an "opcional" badge. Only
 * mandatory fields/sub-sections render by default — the user explicitly
 * adds optional ones via the "+" button at the bottom.
 */
export function BuilderSection({
  section,
  values,
  onChange,
  addedOptionalXPaths,
  onAddOptional,
  onRemoveOptional,
  ecosystemId,
  defaultExpanded,
}: Props) {
  const initialOpen = defaultExpanded ?? section.isMandatory;
  const [open, setOpen] = useState(initialOpen);
  const isAddedOptional =
    !section.isMandatory && addedOptionalXPaths.has(section.xpath);

  const visibleFields = section.fields.filter(
    (f) =>
      f.isMandatory || f.isEcosystemMandatory || addedOptionalXPaths.has(f.xpath),
  );
  const hiddenOptionalFields = section.fields.filter(
    (f) =>
      !f.isMandatory &&
      !f.isEcosystemMandatory &&
      !addedOptionalXPaths.has(f.xpath),
  );
  const visibleSubsections = section.sections.filter(
    (s) => s.isMandatory || addedOptionalXPaths.has(s.xpath),
  );
  const hiddenOptionalSubsections = section.sections.filter(
    (s) => !s.isMandatory && !addedOptionalXPaths.has(s.xpath),
  );

  const hasContent =
    visibleFields.length > 0 || visibleSubsections.length > 0;
  const hasAddable =
    hiddenOptionalFields.length > 0 || hiddenOptionalSubsections.length > 0;

  return (
    <div
      className="rounded-md border border-[var(--border)] overflow-hidden transition-shadow"
      data-testid={`builder-section-${section.xpath}`}
      data-xpath={section.xpath}
    >
      <div
        className={clsx(
          "w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
          section.isMandatory ? "bg-bg-secondary" : "bg-bg-secondary/60",
          "hover:bg-bg-tertiary",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <span className="text-text-tertiary shrink-0">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="text-sm font-semibold font-mono text-text-primary truncate">
            {section.name}
          </span>
          {!section.isMandatory && <Badge tone="neutral">opcional</Badge>}
        </button>
        <span className="text-[10px] font-mono text-text-tertiary shrink-0">
          {section.xpath}
        </span>
        {isAddedOptional && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveOptional(section.xpath);
            }}
            title="Remover seção opcional"
            aria-label="Remover seção opcional"
            data-testid={`builder-remove-section-${section.xpath}`}
            className="shrink-0 p-1 rounded text-text-tertiary hover:text-danger-text hover:bg-bg-tertiary transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="bg-bg-primary p-3 space-y-3">
          {visibleFields.length > 0 && (
            <table className="w-full text-xs">
              <tbody>
                {visibleFields.map((field) => {
                  const fieldAdded =
                    !field.isMandatory &&
                    !field.isEcosystemMandatory &&
                    addedOptionalXPaths.has(field.xpath);
                  return (
                    <BuilderFieldRow
                      key={field.xpath}
                      field={field}
                      value={values[field.xpath] ?? field.value ?? ""}
                      onChange={onChange}
                      onRemove={fieldAdded ? onRemoveOptional : undefined}
                      ecosystemId={ecosystemId}
                      allValues={values}
                    />
                  );
                })}
              </tbody>
            </table>
          )}

          {visibleSubsections.length > 0 && (
            <div className="space-y-2">
              {visibleSubsections.map((child) => (
                <BuilderSection
                  key={child.xpath}
                  section={child}
                  values={values}
                  onChange={onChange}
                  addedOptionalXPaths={addedOptionalXPaths}
                  onAddOptional={onAddOptional}
                  onRemoveOptional={onRemoveOptional}
                  ecosystemId={ecosystemId}
                />
              ))}
            </div>
          )}

          {!hasContent && !hasAddable && (
            <p className="text-[10px] text-text-tertiary italic">
              Nenhum campo obrigatório nesta seção.
            </p>
          )}

          {hasAddable ? (
            <AddOptionalFieldButton
              hiddenFields={hiddenOptionalFields}
              hiddenSections={hiddenOptionalSubsections}
              onAdd={onAddOptional}
            />
          ) : hasContent ? (
            // The inline picker only sees children the server returned in
            // the structure; anything else (TxId, InstrId, deep choice
            // arms…) lives in the available-fields catalogue surfaced by
            // the search bar at the top of the page.
            <p className="text-[10px] text-text-tertiary italic">
              Use a busca acima para adicionar outros campos a esta seção.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
