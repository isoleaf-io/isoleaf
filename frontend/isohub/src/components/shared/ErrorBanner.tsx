import { AlertTriangle } from "lucide-react";

/**
 * Standard error banner. <c>whitespace-pre-line</c> preserves newlines so
 * callers that compose multi-line messages (e.g. a primary detail + a hint)
 * render naturally — single-line messages are unaffected.
 */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-md bg-danger-bg text-danger-text border border-danger/20">
      <AlertTriangle size={16} className="mt-[2px] shrink-0" />
      <span className="text-sm whitespace-pre-line">{message}</span>
    </div>
  );
}
