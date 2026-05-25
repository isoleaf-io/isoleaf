import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { useTemplatesStore } from "@/store/templates";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LoadTemplateModal({ open, onClose }: Props) {
  const { templates, loadTemplate, deleteTemplate } = useTemplatesStore();
  const [filter, setFilter] = useState("");

  const filtered = templates.filter((t) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.mti.includes(q) ||
      (t.tags ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(620px,90vw)] bg-bg-primary border border-[var(--border)] rounded-lg shadow-2xl z-50 focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <Dialog.Title className="text-base font-semibold">Carregar template</Dialog.Title>
            <Dialog.Close className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="p-4 space-y-3">
            <Input
              autoFocus
              placeholder="Buscar por nome, MTI ou tag…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="max-h-[420px] overflow-y-auto -mx-2">
              {templates.length === 0 ? (
                <div className="text-center text-xs text-text-tertiary py-10 space-y-2">
                  <div>Nenhum template salvo ainda.</div>
                  <div className="text-text-tertiary">
                    Use o botão <span className="font-semibold">Salvar template</span> no Builder para salvar mensagens.
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-xs text-text-tertiary py-6">Nenhum template encontrado</div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {filtered
                    .slice()
                    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
                    .map((tpl) => (
                      <li key={tpl.id} className="px-3 py-3 hover:bg-bg-tertiary/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge tone="accent" className="font-mono">{tpl.mti}</Badge>
                              <span className="text-sm font-semibold truncate">{tpl.name}</span>
                            </div>
                            {tpl.description && (
                              <div className="text-xs text-text-secondary truncate">{tpl.description}</div>
                            )}
                            <div className="text-[11px] text-text-tertiary mt-1 flex gap-3">
                              <span>{new Date(tpl.savedAt).toLocaleString()}</span>
                              <span>{tpl.fields.length} campos</span>
                              {tpl.tags && <span className="truncate">tags: {tpl.tags}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => {
                                loadTemplate(tpl.id);
                                onClose();
                              }}
                            >
                              Carregar
                            </Button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Remover template "${tpl.name}"?`)) deleteTemplate(tpl.id);
                              }}
                              className="p-2 rounded text-text-tertiary hover:text-danger hover:bg-danger-bg/40"
                              title="Remover"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
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
