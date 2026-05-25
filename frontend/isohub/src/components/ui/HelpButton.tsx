import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import clsx from "clsx";

interface Props {
  title: string;
  /** Body text — newlines render as paragraph breaks. */
  content: string;
  className?: string;
  /** Optional aria-label for the trigger button (defaults to title). */
  ariaLabel?: string;
}

/**
 * Small "?" trigger that opens an inline popover on click. Closes on outside-click
 * or Escape. Built without a Radix dependency on purpose — the project doesn't
 * pull @radix-ui/react-popover and this affordance is simple enough to live alone.
 */
export function HelpButton({ title, content, className, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Render newlines as separate paragraphs so the content prop can be a single
  // string with `\n` separators instead of a JSX tree.
  const paragraphs = content.split(/\n\n+|\n/).filter((p) => p.trim().length > 0);

  return (
    <div ref={wrapperRef} className={clsx("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel ?? title}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
      >
        <HelpCircle size={13} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title}
          className="absolute z-50 top-full left-0 mt-1 w-72 p-3 rounded-md bg-bg-secondary border border-[var(--border-strong)] shadow-lg text-xs text-text-secondary"
        >
          <div className="font-semibold text-text-primary mb-1">{title}</div>
          <div className="space-y-1.5 whitespace-pre-line">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
