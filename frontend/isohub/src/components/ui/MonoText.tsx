import { HTMLAttributes } from "react";
import clsx from "clsx";

export function MonoText({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx("font-mono text-[13px] tabular-nums break-all", className)}
      {...rest}
    />
  );
}
