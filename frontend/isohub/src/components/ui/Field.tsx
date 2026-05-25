import { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";
import clsx from "clsx";

const baseInput =
  "h-9 px-3 text-sm rounded-md bg-bg-input border border-[var(--border)] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent";

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label className={clsx("text-xs font-medium text-text-secondary block mb-1.5", className)}>
      {children}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(baseInput, "w-full", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(baseInput, "w-full", className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <span
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative w-9 h-5 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-bg-tertiary border border-[var(--border)]"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
            checked && "translate-x-4"
          )}
        />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
