import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { MonoText } from "@/components/ui/MonoText";
import type { FieldDefinitionDto } from "@/api/iso20022Reference";

interface Props {
  field: FieldDefinitionDto;
  defaultExpanded?: boolean;
  /** Fires when the row is clicked. Selecting a complex field also toggles expansion. */
  onSelectField?: (field: FieldDefinitionDto) => void;
  /** XPath of the currently-selected field (highlights it in the tree). */
  selectedXPath?: string;
  /**
   * XPath of a field to spotlight: scrolls into view on mount/update and shows
   * a stronger accent border than the regular selection highlight. The page
   * clears this after a short timeout so it acts as a transient "found it"
   * cue (used when navigating from the search tab).
   */
  highlightXPath?: string;
}

/**
 * Recursive hierarchical view of one <see cref="FieldDefinition"/>. Mirrors
 * the structure of the underlying XSD: complex types expand to show their
 * children; simple types render inline with their cardinality, type name and
 * length facets. Documentation surfaces in a tooltip via <c>title</c> rather
 * than expanding the row — keeps the tree dense.
 */
/** True when <c>target</c> sits beneath <c>ancestorXPath</c> in the tree. */
function isAncestorOf(ancestorXPath: string, target: string | null | undefined): boolean {
  if (!target) return false;
  return target.startsWith(ancestorXPath + "/");
}

export function FieldTree({
  field,
  defaultExpanded,
  onSelectField,
  selectedXPath,
  highlightXPath,
}: Props) {
  // Initial expansion: explicit defaultExpanded wins; otherwise auto-expand
  // when this field is on the path to the highlighted target so the leaf
  // mounts in the first paint instead of needing an effect cascade; finally
  // fall back to "open by default for shallow levels".
  const initial =
    defaultExpanded ?? (isAncestorOf(field.xpath, highlightXPath) || field.depth < 2);
  const [expanded, setExpanded] = useState(initial);
  const lengthLabel = formatLength(field.minLength, field.maxLength);
  const isSelected = selectedXPath != null && selectedXPath === field.xpath;
  const isHighlighted = highlightXPath != null && highlightXPath === field.xpath;
  const rowRef = useRef<HTMLDivElement | null>(null);

  // Whenever this row becomes the highlight target, scroll it into view.
  // useLayoutEffect runs synchronously after DOM mutation so the scroll
  // fires once ancestors have just finished expanding — earlier than the
  // post-paint useEffect, which would skip a frame and sometimes miss the
  // window before the page-level timer clears `highlightedXPath`.
  useLayoutEffect(() => {
    if (!isHighlighted || !rowRef.current) return;
    // Defer to the next animation frame so React has fully committed the
    // ancestor expansion cascade — without this, scrollIntoView occasionally
    // anchors the row off-screen because layout hasn't settled.
    const raf = requestAnimationFrame(() => {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [isHighlighted]);

  // Force-expand whenever this field becomes an ancestor of a *newly* set
  // highlight target. The initial-state hook above already handles newly
  // mounted components — this effect covers the already-mounted ones whose
  // `expanded` was set to false before the highlight arrived.
  useLayoutEffect(() => {
    if (isAncestorOf(field.xpath, highlightXPath)) setExpanded(true);
  }, [highlightXPath, field.xpath]);

  return (
    <div style={{ marginLeft: field.depth === 0 ? 0 : 16 }} className="font-mono text-[12.5px]">
      <div
        ref={rowRef}
        data-testid={`field-row-${field.xpath}`}
        className={clsx(
          "flex items-start gap-2 py-[2px] px-1 rounded leading-snug transition-colors",
          "cursor-pointer hover:bg-bg-tertiary",
          // Highlight wins over plain selection — solid accent ring so the
          // user immediately spots the row scrolled into view, no animation.
          isHighlighted
            ? "bg-accent-bg ring-2 ring-accent"
            : isSelected && "bg-accent-bg ring-1 ring-accent/40",
        )}
        onClick={(e) => {
          e.stopPropagation();
          // Row click opens the detail panel. For complex nodes, also toggles
          // expansion in the same gesture — single click reveals both the
          // detail and the children.
          onSelectField?.(field);
          if (field.isComplex) setExpanded((v) => !v);
        }}
      >
        {/* Chevron is a secondary click target: toggles expansion only and
            stops propagation so the row's onClick (which would also open the
            detail panel) doesn't fire. Lets the user expand without opening
            the drawer when they just want to scan structure. */}
        <span
          className={clsx(
            "w-4 shrink-0 text-text-tertiary mt-[1px]",
            field.isComplex && "cursor-pointer hover:text-text-primary",
          )}
          onClick={(e) => {
            if (!field.isComplex) return;
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {field.isComplex ? (
            expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : null}
        </span>

        <span
          className={clsx(
            "shrink-0",
            field.isComplex && "text-accent-text font-semibold",
            !field.isComplex && field.isMandatory && "text-text-primary",
            !field.isComplex && !field.isMandatory && "text-text-secondary",
          )}
        >
          {field.name}
        </span>

        <span
          className={clsx(
            "text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0",
            field.isMandatory
              ? "bg-accent-bg text-accent-text"
              : "bg-bg-tertiary text-text-tertiary",
          )}
          data-testid={`field-cardinality-${field.xpath}`}
        >
          {field.cardinality}
        </span>

        <span className="text-[11px] text-text-tertiary shrink-0">
          <MonoText>{field.typeName}</MonoText>
        </span>

        {lengthLabel && (
          <span className="text-[11px] text-text-tertiary shrink-0">{lengthLabel}</span>
        )}

        {field.documentation && (
          <span
            className="text-[11px] text-text-tertiary truncate"
            title={field.documentation}
          >
            — {field.documentation}
          </span>
        )}
      </div>

      {field.isComplex && expanded && (
        <div className="border-l border-[var(--border)] ml-[7px]">
          {field.children.map((child, i) => (
            <FieldTree
              key={`${child.name}-${i}`}
              field={child}
              onSelectField={onSelectField}
              selectedXPath={selectedXPath}
              highlightXPath={highlightXPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatLength(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `len=${max}` : `${min}–${max}`;
  }
  if (max != null) return `max=${max}`;
  return `min=${min}`;
}
