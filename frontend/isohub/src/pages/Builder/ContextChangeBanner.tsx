import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  staleCount: number;
  onRegenerate: () => void;
  onScrollToFirst: () => void;
  onIgnore: () => void;
}

export function ContextChangeBanner({ staleCount, onRegenerate, onScrollToFirst, onIgnore }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-md bg-warning-bg/60 text-warning-text border border-warning/30">
      <AlertTriangle size={16} />
      <span className="flex-1 text-sm">
        Contexto mudou — {staleCount > 0
          ? `${staleCount} ${staleCount === 1 ? "campo pode estar inconsistente" : "campos podem estar inconsistentes"} com o novo contexto`
          : "regenere para aplicar as mudanças"}
      </span>
      <Button size="sm" variant="primary" onClick={onRegenerate}>
        <RefreshCw size={12} /> Regenerar todos
      </Button>
      {staleCount > 0 && (
        <Button size="sm" variant="secondary" onClick={onScrollToFirst}>
          Ver afetados
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onIgnore}>
        <X size={12} /> Ignorar
      </Button>
    </div>
  );
}
