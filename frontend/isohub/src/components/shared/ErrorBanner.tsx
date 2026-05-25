import { AlertTriangle } from "lucide-react";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-md bg-danger-bg text-danger-text border border-danger/20">
      <AlertTriangle size={16} />
      <span className="text-sm">{message}</span>
    </div>
  );
}
