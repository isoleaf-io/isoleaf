import { Check, Copy } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

interface Props {
  value: string;
  className?: string;
  size?: number;
}

export function CopyButton({ value, className, size = 14 }: Props) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Copy"
      className={clsx(
        "p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors",
        className
      )}
    >
      {copied ? (
        <Check size={size} className="text-success" />
      ) : (
        <Copy size={size} />
      )}
    </button>
  );
}
