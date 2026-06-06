import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import clsx from "clsx";
import { MonoText } from "@/components/ui/MonoText";
import type { DocBlock } from "./types";

interface Props {
  blocks: DocBlock[];
}

/**
 * Lightweight inline parser — converts `**bold**` to <strong> and `` `code` ``
 * to monospace pills. Used in paragraphs, list items, headings and callouts so
 * the content modules can highlight UI labels without inline JSX.
 *
 * Intentionally not Markdown — no nesting, no escaping. The content files are
 * trusted (no user input lands here).
 */
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  // Order of alternates matters: link pattern is checked first because its
  // outer brackets would otherwise be matched as literal text after the
  // bold/code patterns consume their delimiters.
  const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined && match[2] !== undefined) {
      // [text](url) — mailto: links don't need target=_blank.
      const isExternal = !match[2].startsWith("mailto:");
      parts.push(
        <a
          key={key++}
          href={match[2]}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          className="text-accent underline hover:opacity-80"
        >
          {match[1]}
        </a>,
      );
    } else if (match[3] !== undefined) {
      parts.push(
        <strong key={key++} className="font-semibold text-text-primary">
          {match[3]}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      parts.push(
        <code
          key={key++}
          className="text-[0.85em] bg-bg-tertiary px-1 py-0.5 rounded font-mono text-text-mono"
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 0 ? text : <>{parts}</>;
}

/**
 * Renders a structured DocBlock[] into prose. Keeps the docs free of inline
 * JSX in the content files so the same renderer serves PT and EN.
 */
export function DocBlocks({ blocks }: Props) {
  return (
    <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 2 ? "h3" : block.level === 3 ? "h4" : "h5";
      const cls =
        block.level === 2
          ? "text-base font-semibold text-text-primary mt-3 mb-1"
          : block.level === 3
          ? "text-sm font-semibold text-text-primary mt-2 mb-0.5"
          : "text-xs font-semibold text-text-secondary uppercase tracking-wider mt-1 mb-0.5";
      if (block.subtitle) {
        return (
          <div className="mt-3 mb-1">
            <Tag className={clsx(cls, "mt-0 mb-0")}>{renderInline(block.text)}</Tag>
            <p className="text-xs text-text-tertiary italic mt-0.5">{renderInline(block.subtitle)}</p>
          </div>
        );
      }
      return <Tag className={cls}>{renderInline(block.text)}</Tag>;
    }
    case "paragraph":
      return <p>{renderInline(block.text)}</p>;
    case "list":
      return block.ordered ? (
        <ol className="list-decimal pl-5 space-y-1">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc pl-5 space-y-1">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre className="bg-bg-input border border-[var(--border)] rounded-md p-3 text-xs font-mono text-text-mono overflow-x-auto whitespace-pre">
          {block.text}
        </pre>
      );
    case "diagram":
      // Diagrams are ASCII art — preserve every space and line, monospace, scrolls
      // horizontally on narrow viewports.
      return (
        <pre className="bg-bg-input border border-[var(--border)] rounded-md p-3 text-[10px] sm:text-[11px] font-mono text-text-mono overflow-x-auto leading-tight whitespace-pre">
          {block.text}
        </pre>
      );
    case "table":
      return (
        <div className="overflow-x-auto border border-[var(--border)] rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-bg-tertiary">
              <tr>
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="text-left font-semibold text-text-secondary px-3 py-2 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {block.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-bg-tertiary/40">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 align-top">
                      {/* First column gets monospace styling — usually a tag, bit
                          number or short identifier. The rest stays plain text. */}
                      {ci === 0 ? <MonoText>{cell}</MonoText> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "svg":
      // Inline SVG, only ever sourced from static content modules (never user input).
      // Wrapped in overflow-x:auto so wide diagrams scroll on small viewports.
      return (
        <div
          className="overflow-x-auto py-2"
          dangerouslySetInnerHTML={{ __html: block.text }}
        />
      );
    case "image":
      return (
        <figure className="my-4">
          <img
            src={block.src}
            alt={block.alt}
            className="rounded-lg border border-[var(--border)] shadow-sm w-full max-w-3xl mx-auto block"
            loading="lazy"
          />
          {block.caption && (
            <figcaption className="text-center text-xs text-text-tertiary mt-2 italic">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    case "callout": {
      const cfg = {
        info: { Icon: Info, cls: "border-accent/40 bg-accent-bg/30 text-accent-text" },
        warning: { Icon: AlertTriangle, cls: "border-warning/40 bg-warning-bg/40 text-warning-text" },
        success: { Icon: CheckCircle2, cls: "border-success/40 bg-success-bg/30 text-success-text" },
        danger: { Icon: XCircle, cls: "border-danger/40 bg-danger-bg/30 text-danger-text" },
      }[block.tone];
      const Icon = cfg.Icon;
      return (
        <div className={clsx("rounded-md border px-3 py-2 flex items-start gap-2 text-xs", cfg.cls)}>
          <Icon size={14} className="mt-0.5 shrink-0" />
          <span>{renderInline(block.text)}</span>
        </div>
      );
    }
    case "divider":
      return <hr className="my-6 border-t border-[var(--border)]" />;
    default:
      return null;
  }
}
