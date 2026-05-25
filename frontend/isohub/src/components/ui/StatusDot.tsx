import clsx from "clsx";

interface Props {
  status: "online" | "offline" | "warning";
  className?: string;
}

const colors = {
  online: "bg-success",
  offline: "bg-danger",
  warning: "bg-warning",
};

export function StatusDot({ status, className }: Props) {
  return (
    <span className={clsx("inline-block w-2 h-2 rounded-full", colors[status], className)} />
  );
}
