import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { MonoText } from "@/components/ui/MonoText";
import { getLayoutFields } from "@/api/parse";
import type { LayoutFieldDefinition } from "@/types";

interface Props {
  open: boolean;
  presentBits: Set<number>;
  onClose: () => void;
  onAdd: (bit: number, name: string) => void;
}

export function AddFieldModal({ open, presentBits, onClose, onAdd }: Props) {
  const [filter, setFilter] = useState("");

  // Cache the layout — it's static for the session.
  const layoutQuery = useQuery({
    queryKey: ["layout-fields", "default"],
    queryFn: () => getLayoutFields("default"),
    enabled: open,
    staleTime: Infinity,
  });

  const available = useMemo<LayoutFieldDefinition[]>(
    () => (layoutQuery.data ?? []).filter((f) => !presentBits.has(f.bitNumber)),
    [layoutQuery.data, presentBits]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (f) => f.name.toLowerCase().includes(q) || String(f.bitNumber).includes(q)
    );
  }, [available, filter]);

  // Custom-bit fallback: filter is a number AND that bit is neither present
  // nor in the layout. Lets users add private fields (e.g. bits 60-63).
  const customBit = useMemo(() => {
    const n = Number(filter.trim());
    if (!Number.isInteger(n) || n < 1 || n > 128) return null;
    if (presentBits.has(n)) return null;
    if ((layoutQuery.data ?? []).some((f) => f.bitNumber === n)) return null;
    return n;
  }, [filter, presentBits, layoutQuery.data]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,90vw)] bg-bg-primary border border-[var(--border)] rounded-lg shadow-2xl z-50 focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <Dialog.Title className="text-base font-semibold">Adicionar campo</Dialog.Title>
            <Dialog.Close className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="p-4 space-y-3">
            <Input
              autoFocus
              placeholder="Buscar por número ou nome…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />

            {layoutQuery.isLoading && (
              <div className="text-center text-xs text-text-tertiary py-6">Carregando layout…</div>
            )}

            {layoutQuery.isError && (
              <div className="text-center text-xs text-danger py-6">
                Falha ao carregar layout — verifique se o Agent está online.
              </div>
            )}

            <div className="max-h-[360px] overflow-y-auto -mx-2">
              {customBit !== null && (
                <div className="border-b border-[var(--border)] mb-1">
                  <button
                    type="button"
                    onClick={() => onAdd(customBit, "Custom Field")}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg-tertiary"
                  >
                    <span className="font-mono text-accent-text w-12">{customBit}</span>
                    <span className="flex-1">Adicionar Bit {customBit} (campo personalizado)</span>
                    <Plus size={14} className="text-accent" />
                  </button>
                </div>
              )}

              {!layoutQuery.isLoading && filtered.length === 0 && customBit === null && (
                <div className="text-center text-xs text-text-tertiary py-6">
                  {available.length === 0 ? "Todos os campos já estão na mensagem" : "Nenhum campo encontrado"}
                </div>
              )}

              <ul className="divide-y divide-[var(--border)]">
                {filtered.map((f) => (
                  <li key={f.bitNumber}>
                    <button
                      type="button"
                      onClick={() => onAdd(f.bitNumber, f.name)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-bg-tertiary"
                    >
                      <MonoText className="text-text-tertiary w-12">{f.bitNumber}</MonoText>
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        {f.type} · {f.encoding} · {f.maxLength}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex justify-end px-5 py-3 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
