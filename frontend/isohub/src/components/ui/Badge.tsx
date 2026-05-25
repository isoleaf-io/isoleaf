import { HTMLAttributes } from "react";
import clsx from "clsx";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: "bg-bg-tertiary text-text-secondary",
  accent: "bg-accent-bg text-accent-text",
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  danger: "bg-danger-bg text-danger-text",
};

export function Badge({ className, tone = "neutral", ...rest }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
        tones[tone],
        className
      )}
      {...rest}
    />
  );
}
