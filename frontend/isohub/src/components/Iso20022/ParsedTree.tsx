import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { ParsedNode } from "@/api/iso20022";

interface Props {
  node: ParsedNode;
  depth?: number;
  defaultExpanded?: boolean;
}

/**
 * Recursive tree view for an ISO 20022 parsed document. Attributes appear as
 * leaf children whose name is prefixed with <c>@</c>; containers (anything
 * with children) are collapsible. Top two depths default to expanded so the
 * GrpHdr/CdtTrfTxInf overview is visible without extra clicks.
 */
export function ParsedTree({ node, depth = 0, defaultExpanded }: Props) {
  const hasChildren = node.children.length > 0;
  const isAttr = node.name.startsWith("@");
  const initialOpen = defaultExpanded ?? depth < 2;
  const [expanded, setExpanded] = useState(initialOpen);

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 16 }} className="font-mono text-[12.5px]">
      <div
        className={clsx(
          "flex items-start gap-1 py-[2px] rounded px-1 leading-snug",
          hasChildren && "cursor-pointer hover:bg-bg-tertiary",
        )}
        onClick={() => hasChildren && setExpanded((v) => !v)}
      >
        <span className="w-4 shrink-0 text-text-tertiary select-none mt-[1px]">
          {hasChildren ? (
            expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : null}
        </span>

        <span
          className={clsx(
            "shrink-0",
            isAttr && "text-warning-text font-medium",
            !isAttr && hasChildren && "text-accent-text font-semibold",
            !isAttr && !hasChildren && "text-text-primary",
          )}
        >
          {node.name}
        </span>

        {node.namespace && (
          <span
            className="text-text-tertiary text-[11px] ml-1"
            title={node.namespace}
          >
            [{node.namespace.split(":").pop()}]
          </span>
        )}

        {!hasChildren && node.value && (
          <>
            <span className="text-text-tertiary mx-1.5">=</span>
            <span className="text-success-text break-all">{node.value}</span>
          </>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="border-l border-[var(--border)] ml-[7px]">
          {node.children.map((child, i) => (
            <ParsedTree
              key={`${child.name}-${i}`}
              node={child}
              depth={depth + 1}
              defaultExpanded={depth + 1 < 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}
