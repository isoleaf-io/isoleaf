import clsx from "clsx";

interface Props {
  status: "online" | "offline" | "warning" | "neutral";
  className?: string;
}

const colors = {
  online: "bg-success",
  offline: "bg-danger",
  warning: "bg-warning",
  // Sprint 12.4 — neutral state for the Agent indicator when the operator
  // hasn't configured the URL yet OR is on a page that hasn't probed the
  // Agent, so "we simply don't know" reads as grey instead of alarming red.
  neutral: "bg-text-tertiary/50",
};

export function StatusDot({ status, className }: Props) {
  return (
    <span className={clsx("inline-block w-2 h-2 rounded-full", colors[status], className)} />
  );
}
