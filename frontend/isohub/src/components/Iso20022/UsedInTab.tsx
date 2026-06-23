import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import clsx from "clsx";
import type { FieldSearchResultDto } from "@/api/iso20022Reference";
import { extractPrefix, getFamilyByPrefix } from "@/config/iso20022Families";
import {
  analyzeCompatibility,
  type CompatibleFamily,
  type IncompatibleOccurrence,
} from "./usedInCompatibility";

interface Props {
  usedIn: FieldSearchResultDto;
  currentMessageType: string;
}

/**
 * "Used in" tab — answers "can I reuse my parser for this field?". Splits
 * cross-message-type occurrences into a compatible bucket (same type +
 * cardinality as the user's reference) rolled up by family, and an
 * incompatible bucket where each row expands to show the exact differences.
 */
export function UsedInTab({ usedIn, currentMessageType }: Props) {
  const analysis = analyzeCompatibility(currentMessageType, usedIn.occurrences);

  return (
    <div className="flex flex-col gap-5" data-testid="used-in-tab">
      {analysis.compatibleFamilies.length > 0 && (
        <section
          className="flex flex-col gap-2"
          data-testid="used-in-compatible-section"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-success-text text-sm font-semibold">
              ✓ Reutilize sua implementação
            </span>
            <span className="text-xs text-text-tertiary">
              {analysis.totalCompatible} versões · mesmo tipo (
              <span className="font-mono">{analysis.currentTypeName}</span>) e
              cardinalidade (
              <span className="font-mono">{analysis.currentCardinality}</span>)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {analysis.compatibleFamilies.map((family) => (
              <FamilyGroup
                key={family.prefix}
                family={family}
                currentMessageType={currentMessageType}
              />
            ))}
          </div>
        </section>
      )}

      {analysis.incompatibleOccurrences.length > 0 && (
        <section
          className="flex flex-col gap-2"
          data-testid="used-in-incompatible-section"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-warning-text text-sm font-semibold">
              ⚠ Adapte para
            </span>
            <span className="text-xs text-text-tertiary">
              {analysis.totalIncompatible} versões com comportamento diferente
            </span>
          </div>

          <div className="rounded-md border border-warning/30 bg-warning-bg/20 overflow-hidden">
            {analysis.incompatibleOccurrences.map((occ, i) => (
              <IncompatibleRow
                key={occ.messageType}
                occ={occ}
                isLast={i === analysis.incompatibleOccurrences.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex items-start gap-2 text-xs text-text-tertiary border-t border-[var(--border)] pt-4">
        <Info size={12} className="mt-[2px] shrink-0" />
        <span>
          Compatibilidade técnica não garante equivalência semântica. Consulte a
          documentação do ecossistema que está implementando.
        </span>
      </div>
    </div>
  );
}

function FamilyGroup({
  family,
  currentMessageType,
}: {
  family: CompatibleFamily;
  currentMessageType: string;
}) {
  // The reference family auto-expands so the user sees the in-context details
  // first. Everything else stays collapsed to keep the page scannable when
  // a field shows up in dozens of types.
  const [expanded, setExpanded] = useState(
    extractPrefix(currentMessageType) === family.prefix,
  );

  const totalVersions = Object.values(family.versionsByMessageId).reduce(
    (sum, vs) => sum + vs.length,
    0,
  );

  return (
    <div
      className="rounded-md border border-[var(--border)] overflow-hidden"
      data-testid={`family-group-${family.prefix}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-bg-secondary hover:bg-bg-tertiary transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-text-tertiary shrink-0">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="text-sm font-semibold text-text-primary">
            {family.officialName}
          </span>
          <span className="text-xs text-text-tertiary font-mono">
            ({family.prefix})
          </span>
        </div>
        <span className="text-xs text-text-tertiary shrink-0">
          {family.messageIds.length} tipo(s) · {totalVersions} versão(ões)
        </span>
      </button>

      {expanded && (
        <div
          className="divide-y divide-[var(--border)]"
          data-testid={`family-content-${family.prefix}`}
        >
          {family.messageIds.map((msgId) => (
            <div
              key={msgId}
              className="flex items-center justify-between gap-3 px-4 py-2 bg-bg-primary hover:bg-bg-secondary/40 transition-colors"
            >
              <span className="font-mono text-xs text-text-mono shrink-0">
                {msgId}
              </span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {family.versionsByMessageId[msgId].map((v) => (
                  <span
                    key={v}
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary border border-[var(--border)]"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IncompatibleRow({
  occ,
  isLast,
}: {
  occ: IncompatibleOccurrence;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const family = getFamilyByPrefix(extractPrefix(occ.messageType));

  return (
    <div
      className={clsx("bg-bg-primary", !isLast && "border-b border-[var(--border)]")}
      data-testid={`incompatible-row-${occ.messageType}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-warning-bg/30 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-warning-text shrink-0">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="font-mono text-xs text-text-mono">{occ.messageType}</span>
          {family && (
            <span className="text-xs text-text-tertiary truncate">
              {family.officialName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={clsx(
              "text-[11px] px-1.5 py-0.5 rounded font-mono",
              occ.isMandatory
                ? "bg-accent-bg text-accent-text"
                : "bg-bg-tertiary text-text-tertiary",
            )}
          >
            {occ.cardinality}
          </span>
          <span className="text-xs font-mono text-text-secondary">{occ.typeName}</span>
        </div>
      </button>

      {expanded && (
        <div
          className="px-4 pb-3 pt-2 flex flex-col gap-2 border-t border-[var(--border)] bg-warning-bg/10"
          data-testid={`incompatible-row-detail-${occ.messageType}`}
        >
          <div className="flex flex-col gap-1">
            {occ.differences.map((diff, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-warning-text text-xs shrink-0 mt-0.5">·</span>
                <span className="text-xs text-text-primary">{diff}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-text-tertiary shrink-0">XPath</span>
            <span
              className="font-mono text-xs text-text-tertiary truncate"
              title={occ.xpath}
            >
              {occ.xpath}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
